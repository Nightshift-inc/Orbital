# Blackbox — Investigation Agent Architecture

This document describes how the investigation layer works inside Blackbox: how
agents are spawned, what tools they have, and how the same code path serves
both webhook-triggered investigations and the local CLI harness.

If you're picking this up cold, read this top to bottom, then `handoff.md`
for the broader project context.

---

## Deployment shape

Blackbox is deployed as a **GitHub App**. It is not a CLI bound to a single
repo. The runtime flow is:

```
GitHub repo (any repo the App is installed on)
        │
        │  webhook events
        ▼
  app.js  ── createNodeMiddleware → octokit/webhooks
        │
        │  app.webhooks.on("pull_request.closed", ...)
        │  fire-and-forget
        ▼
  lib/investigations.ts → runInvestigation({ octokit, owner, repo, ... })
        │
        │  buildInvestigationTools({ octokit, owner, repo, ... })
        │  — closes over installation-scoped octokit
        ▼
  CopilotSession (root)  →  CopilotSession (child × N)
        │                          │
        ▼                          ▼
        tools (per-session)   tools (per-session)
        │
        ▼
  octokit.rest.issues.create(...)  ← installation auth gives write access
  octokit.rest.issues.createComment(...)
```

Two non-negotiables fall out of this:

1. **Tools are installation-scoped factories.** Every tool that touches
   GitHub takes its `octokit` from the webhook handler's destructured
   argument. The factory pattern in `lib/tools/` enforces this: the tool
   closes over `{ octokit, owner, repo }` at construction time, not at
   import time. There is no global Octokit. There is no global "current
   repo." Each investigation gets its own toolset.

2. **The webhook returns 200 immediately.** Investigations take 30–90s,
   webhooks must respond in ~10s. `runInvestigation` is fire-and-forget;
   the orchestrator (not the handler) writes back to GitHub when done.

---

## Repo layout

```
github-app-js-sample/
├── app.js                          # GitHub App webhook listener (entry point)
├── investigate.ts                  # CLI harness — same tools, PAT-backed Octokit
├── pr-visualizer.ts                # Standalone PR-age demo (separate from Blackbox)
├── lib/
│   ├── copilot.ts                  # Copilot SDK client + session factory
│   ├── investigations.ts           # runInvestigation(args) — Mode 1 entry point
│   ├── smoke-test.ts               # SDK auth + streaming smoke test
│   └── tools/
│       ├── index.ts                # buildInvestigationTools(deps)
│       ├── types.ts                # ToolDef, ToolDeps, ToolFactory
│       ├── github-search.ts        # ── existing ──
│       ├── checkout-repo.ts
│       ├── ripgrep.ts
│       ├── git-log.ts
│       ├── find-pr-for-commit.ts
│       ├── get-recent-prs.ts       # ── new (handoff requirement) ──
│       ├── get-deploy-log.ts
│       ├── get-app-errors.ts
│       └── get-service-map.ts
├── docs/
│   └── ARCHITECTURE.md             # this file
├── handoff.md                      # broader project handoff
└── .investigations/                # per-investigation clone workspace (gitignored)
```

---

## Tool catalogue

All tools are produced by `buildInvestigationTools(deps: ToolDeps)`. Each
factory returns a `ToolDef` with `{ name, description, parameters, handler }`
in the shape the Copilot SDK accepts.

`ToolDeps`:

```typescript
{
  octokit: Octokit,        // installation-scoped (App) or PAT-backed (CLI)
  owner: string,           // bound target repo owner
  repo:  string,           // bound target repo name
  workspace: string,       // local dir for clones (.investigations)
  cloneToken?: string,     // token usable for `git clone` private repos
}
```

### GitHub data tools (handoff requirements)

| Tool | Purpose | Source |
|---|---|---|
| `get_app_errors` | What's broken right now | Issues with bug/incident/error/outage/p0/p1 labels + failed workflow runs |
| `get_deploy_log` | What shipped recently | GitHub Deployments API + Actions runs whose name matches `deploy/release/publish/cd` |
| `get_recent_prs` | Recent PR activity, filtered by author/since/state | `pulls.list` sorted by `updated` desc |
| `get_service_map` | Service graph of a checked-out repo | Walks tree, detects `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `pom.xml` / `Dockerfile`, emits nodes + intra-repo dep edges |
| `find_pr_for_commit` | Attribute a SHA to a PR | `GET /repos/{o}/{r}/commits/{sha}/pulls` |

### Code exploration tools

| Tool | Purpose |
|---|---|
| `github_search` | Cross-repo code search via GitHub's API |
| `checkout_repo` | Shallow blobless clone into the workspace |
| `ripgrep` | Regex search inside a checked-out repo |
| `git_log` | Recent commits, optionally path-scoped; auto-unshallows |

### Defaulting behavior

GitHub-API tools default `owner` and `repo` to the bound target. Each one
also exposes optional `owner` / `repo` parameters so the agent can cross
into another repo within the same installation when the investigation
warrants it (e.g. tracing a dependency upstream).

---

## Investigation flow (Mode 1)

Inside `runInvestigation`:

1. **Build tools** for this investigation, closing over the installation
   octokit and target repo.
2. **Spawn root agent** with the full toolset.
3. **Root identifies affected services** (typed text, not structured —
   parsed line-by-line for service names).
4. **Spawn child agents in parallel**, one per service. Each child gets
   the same toolset and a service-scoped system prompt.
5. **Children investigate independently.** Token-level streaming is teed
   from each session into a shared `EventEmitter` so the dashboard sees
   live agent reasoning.
6. **Root synthesizes.** Children's findings are joined and the root
   produces the final report.
7. **Post to GitHub.** The orchestrator (not the handler) calls
   `octokit.rest.issues.create` with the installation-scoped client.
8. **Disconnect.** All sessions are torn down on success or error.

### Recommended triage prompt for the root agent

```
1. get_app_errors    — what's actually broken
2. get_deploy_log    — what shipped recently
3. get_recent_prs    — PRs that landed near the incident
4. find_pr_for_commit — attribute a suspect SHA to its PR
5. checkout_repo + get_service_map — scope blast radius, find owners
6. ripgrep + git_log — read the actual code change
```

This sequence is encoded in `ROOT_AGENT_PROMPT` inside
`lib/investigations.ts`.

---

## Streaming (Stream A → Stream B)

Two streams, one bridge:

- **Stream A** — Copilot SDK token deltas via the `assistant.message_delta`
  event on a session. Each chunk is a partial assistant message.
- **Stream B** — application event bus (`investigationBus`, an
  `EventEmitter`). Domain events: `started`, `agent.spawned`, `agent.token`,
  `tool.called`, `agent.findings`, `report.complete`, `github.issue.created`,
  `error`.

`teeAgentCall` subscribes to Stream A on a session and re-emits each delta
into Stream B as `agent.token`. The dashboard subscribes to Stream B over
SSE and renders both flowing-text panels (token events) and a discrete
timeline (everything else).

---

## CLI vs webhook — same tools, different entry points

`investigate.ts` is a REPL that exists for two reasons:

1. Manual ergonomic testing of new tools without setting up a webhook
   round-trip.
2. Running investigations against a repo you have a PAT for, when the App
   isn't installed there yet.

It resolves the target repo in this order:
1. `--repo owner/name` flag
2. `git remote get-url origin` of the cwd (if it's a GitHub remote)
3. Interactive prompt

Both entry points call `buildInvestigationTools(deps)` with the same shape.
The only differences are:

| | Webhook (App) | CLI |
|---|---|---|
| `octokit` | from `app.webhooks.on(...)` destructured arg | `new Octokit({ auth: PAT })` |
| `owner`, `repo` | from `payload.repository` | from `--repo` / git remote |
| `cloneToken` | installation access token | the PAT itself |
| Output | GitHub Issue created via installation auth | printed to stdout |

If you're adding a new tool, the test loop is: write the factory, smoke
it via the CLI against a public repo, then it works in the App with no
additional wiring.

---

## Adding a new tool

1. Create `lib/tools/<kebab-case>.ts` exporting `make<PascalCase>: ToolFactory`.
2. Append it to the array returned by `buildInvestigationTools` in
   `lib/tools/index.ts`.
3. If it surfaces a new triage step, update `ROOT_AGENT_PROMPT` in
   `lib/investigations.ts` to mention when to use it.
4. Smoke-test via `npx tsx investigate.ts --repo owner/name`.

A factory should:
- Take `ToolDeps` and close over `octokit`, `owner`, `repo` as needed.
- Never read `process.env` directly — env should be threaded through
  `ToolDeps` if needed.
- Return a `string` from its handler. The Copilot SDK passes that back
  to the model as the tool result. Use `JSON.stringify(..., null, 2)`
  for structured payloads.
- Fail soft with a human-readable string when an API call errors —
  throwing here aborts the agent's turn.

---

## Open architectural questions

These are inherited from `handoff.md` and remain relevant:

1. **Streaming method for child sessions** — verify that
   `assistant.message_delta` fires on child sessions the same way it does
   on the root. The smoke test in `lib/smoke-test.ts` only covers a
   single session.
2. **Tool propagation to child sessions** — currently each child gets
   the same `tools` array passed at `createSession` time. If the SDK ever
   adds nested-session inheritance, simplify accordingly.
3. **Rate limits** — a single investigation makes ~6–10 GitHub API calls
   per agent. With N children that's `(1 + N) × 6–10`. Well under the
   5000/hour App limit but worth watching during demo rehearsals.
4. **Cross-repo investigations** — `get_recent_prs` and friends accept
   optional `owner`/`repo` overrides, but `checkout_repo` workspace
   isolation per repo means a heavily cross-repo investigation can grow
   the workspace fast. No GC yet.
