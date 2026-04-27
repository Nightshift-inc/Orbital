# Blackbox — Engineering Handoff

**Last updated:** April 25, 2026
**Status:** Mode 1 (Reactive Investigation) and Mode 2 (Service Map) implemented at orchestrator level. Streaming layer not yet wired. Mode 3 (Heatmap) not started. Demo deadline: April 26 PST midnight.

This document is for whoever is picking up the project next — including you, future-self, after a few hours of sleep. Read top to bottom before writing code.

---

## What Blackbox is, in two sentences

A multi-agent incident-forensics service. When a PR merges to a watched repo, Blackbox spawns a tree of Copilot SDK agents that investigate which PR caused a production incident, scores them by confidence, and posts the result back to GitHub as an Issue and PR comment.

The demo target is **Lunchducks**, a fictional food-delivery monorepo with a deliberately seeded auth-middleware bug on PR #847.

---

## What's done

- GitHub App registered. App ID and Client ID in hand. Private key generated.
- Webhook secret generated. Webhook subscribed to `pull_request` and `push` events.
- App installed on the test repo (`blackbox-webhook-test`).
- Sample backend (`github-app-js-sample`) cloned and running locally with smee.io tunneling.
- Copilot SDK (`@github/copilot-sdk`) integration started: `CopilotClient` boots, sessions can be created, `sendAndWait` returns text.
- Mode 1 orchestrator skeleton: root agent + child agent spawn pattern works end-to-end with mock tools.
- Mode 2 orchestrator skeleton: service map agent constructs a `ServiceGraph` from Lunchducks repo structure.
- Lunchducks demo repo and 5 fixture JSONs (deploy log, app errors, config changes, performance baselines, PR history) are seeded, validated, and aligned to PR #847 producing a 90% confidence score.

## What's not done

- Streaming. Today everything blocks on `sendAndWait` and emits no progress to the dashboard.
- SSE endpoint on the backend. Dashboard has no way to receive live events.
- Dashboard streaming view. Static report cards exist; the live agent-reasoning panel doesn't.
- Mode 3 entirely. Heatmap pipeline, insights agent, and view all blank.
- Webhook → investigation kickoff. Webhooks land but don't trigger anything yet.
- Azure deploy. Backend runs locally only.
- GitHub Issue creation and PR comment posting from the agent. Tool stubs return success without writing.

---

## Streaming architecture — the part that matters most

There are **two streams** in Blackbox and they need to coexist cleanly. People conflate them and lose hours.

### Stream A — SDK token stream

Inside an agent call (e.g. `session.send({ prompt })`), the Copilot SDK gives you tokens as they arrive from the model. We want these surfaced to the dashboard so users watch the agent think, not buffered until the call completes.

Verify the SDK's exact streaming method by inspecting the session object:

```typescript
const c = await getCopilotClient();
const s = await c.createSession({ onPermissionRequest: approveAll, model: "claude-sonnet-4.5" });
console.log(Object.keys(s).filter(k => typeof (s as any)[k] === "function"));
```

Likely candidates: `s.send({ prompt })` returns an async iterable, OR `s.sendAndWait({ prompt, onToken })` accepts a callback. Whichever it is, that's the source of Stream A.

### Stream B — application event bus

Our own domain events: `agent.spawned`, `tool.called`, `agent.findings`, `child.complete`, `report.complete`, `github.issue.created`. Driven by an `EventEmitter` the orchestrator writes to and an SSE handler reads from. Nothing SDK-specific.

### How they fit together

The orchestrator owns Stream B. Inside the orchestrator, when it makes an agent call, it tees Stream A's tokens into Stream B as `agent.token` events. The dashboard subscribes to Stream B for an investigation ID and renders both kinds of events:

- `agent.token` → appended into a flowing text panel for the relevant agent
- everything else → discrete entries in the investigation timeline

Pseudocode shape:

```typescript
async function teeAgentCall(args: {
  bus: EventEmitter;
  investigationId: string;
  role: "root" | "child";
  service?: string;
  session: CopilotSession;
  prompt: string;
}): Promise<string> {
  const buf: string[] = [];
  for await (const token of args.session.send({ prompt: args.prompt })) {
    buf.push(token);
    args.bus.emit(args.investigationId, {
      type: "agent.token",
      role: args.role,
      service: args.service,
      text: token,
      ts: Date.now(),
    });
  }
  return buf.join("");
}
```

Every place that previously called `sendAndWait` becomes a call to `teeAgentCall`. Same return type (string), with the side effect of streaming events.

---

## The fire-and-forget pattern

GitHub webhooks expect a 200 response within ~10 seconds. Investigations take 30-90 seconds. So:

```typescript
app.webhooks.on("pull_request.closed", async ({ octokit, payload }) => {
  if (!payload.pull_request.merged) return;       // ignore close-without-merge
  if (payload.pull_request.draft) return;         // ignore drafts

  const investigationId = randomUUID();

  // Fire and forget. Do NOT await.
  runInvestigation({ investigationId, octokit, payload })
    .catch(err => console.error(`Investigation ${investigationId} failed:`, err));

  // Webhook returns 200 here, immediately.
});
```

The `.catch` is non-negotiable. Without it, an unhandled rejection in `runInvestigation` will crash the Node process. We've already had this happen once.

The dashboard learns about new investigations via two channels:

1. The frontend polls `GET /api/investigations` every 5 seconds for the investigation list, OR
2. We expose a global SSE feed at `GET /api/feed` that emits `investigation.started` whenever one fires.

Channel 2 is nicer but channel 1 is fine for the demo. Pick whichever ships faster.

---

## Webhooks as workflow triggers — design philosophy

The team explicitly wants webhooks to **trigger workflows and checks**, not block on results. This shapes a few decisions:

**Webhooks don't carry investigation outcomes back to GitHub directly.** The webhook handler enqueues; the orchestrator runs; the orchestrator (not the handler) calls `octokit.rest.issues.create` when the investigation completes. This keeps the handler thin and lets investigations span timeouts.

**Webhook events are the API.** Anything we want to trigger Blackbox should arrive as a webhook event. We currently subscribe to `pull_request` and `push`. We should also add:

- `workflow_run` — triggers a Mode 1 investigation when a CI workflow fails on `main`
- `check_suite` — same, but for GitHub-native check failures

Each of these is one extra `app.webhooks.on(...)` handler that calls into the same `runInvestigation` orchestrator. The orchestrator is event-source-agnostic — it doesn't care if the trigger was a merge, a failed CI run, or a manual dashboard click.

**Manual dashboard triggers reuse the same path.** A "Run investigation" button on the dashboard POSTs to `/api/investigations`, which calls `runInvestigation` with the same shape as a webhook handler. One orchestrator, multiple entry points.

---

## File layout we're converging on

```
blackbox/
├── src/
│   ├── server.ts                  # Express app — webhooks + SSE + manual triggers
│   ├── webhooks/
│   │   └── handlers.ts            # all app.webhooks.on(...) handlers, all fire-and-forget
│   ├── orchestrator/
│   │   ├── investigation.ts       # runInvestigation(args)  — Mode 1 entry point
│   │   ├── service-map.ts         # buildServiceMap(args)   — Mode 2 entry point
│   │   ├── heatmap.ts             # buildHeatmap(args)      — Mode 3 entry point
│   │   ├── confidence.ts          # confidence scoring formula (pure functions, unit-testable)
│   │   └── tee.ts                 # teeAgentCall(...) — Stream A → Stream B bridge
│   ├── tools/
│   │   ├── get_recent_prs.ts
│   │   ├── get_deploy_log.ts
│   │   ├── get_app_errors.ts
│   │   ├── get_config_changes.ts
│   │   ├── get_service_map.ts
│   │   ├── get_blast_radius.ts
│   │   ├── create_github_issue.ts
│   │   └── comment_on_pr.ts
│   ├── lib/
│   │   ├── copilot.ts             # SDK client + session factory
│   │   ├── bus.ts                 # EventEmitter singleton
│   │   ├── octokit.ts             # GitHub App client setup
│   │   └── fixtures.ts            # in-memory load of the 5 JSON files at startup
│   └── prompts/
│       ├── root-agent.ts          # Mode 1 root agent system prompt
│       ├── child-agent.ts         # Mode 1 child agent system prompt
│       ├── map-agent.ts           # Mode 2 system prompt
│       └── insights-agent.ts      # Mode 3 system prompt
├── frontend/                      # Next.js dashboard
└── fixtures/                      # the 5 JSON files loaded at startup
```

The orchestrator files are entry points called from webhook handlers AND from manual API routes. Tools are single-purpose modules each exporting one function. Prompts are version-controlled strings, not strings inline in agent code.

---

## Concrete next-up tasks, in build order

**Task 1 — wire the event bus and SSE endpoint.** ~1 hour.

Create `src/lib/bus.ts` exporting a singleton `EventEmitter`. Add `GET /api/investigations/:id/stream` to the Express app. SSE handler subscribes to `bus.on(id, listener)`, writes `data: ${JSON.stringify(event)}\n\n` for each event, sends keepalive comments every 15 seconds, cleans up on `req.on('close')`.

This is the demo-load-bearing infrastructure. Build it before touching agents again.

**Task 2 — refactor existing Mode 1 + Mode 2 to emit events.** ~2 hours.

Wrap every existing `session.sendAndWait(...)` call in `teeAgentCall(...)`. Add explicit `bus.emit(id, { type: "agent.spawned", ... })` calls at the top of each agent invocation, `bus.emit(id, { type: "tool.called", ... })` inside each tool wrapper, and `bus.emit(id, { type: "report.complete", ... })` at the end.

Before this task, you can manually `curl /api/investigations/:id/stream` and see live events in the terminal. That's the proof point.

**Task 3 — wire the webhook to fire investigations.** ~1 hour.

In `src/webhooks/handlers.ts`, add the `pull_request.closed` handler exactly as sketched above. Test by opening and merging a PR on `blackbox-webhook-test`. Confirm the webhook fires the orchestrator and events flow to the SSE endpoint.

**Task 4 — dashboard streaming view.** ~3-4 hours.

`useEffect` hook subscribes to `EventSource("/api/investigations/:id/stream")`. State is a flat list of events. Render the live panel by walking the list and grouping `agent.token` events into flowing-text blocks per agent role/service. Render the timeline by filtering to non-token events. Two views, same event stream.

**Task 5 — actually create the GitHub Issue and PR comment.** ~1 hour.

Replace the stubs in `tools/create_github_issue.ts` and `tools/comment_on_pr.ts` with real `octokit.rest.issues.create` and `octokit.rest.issues.createComment` calls. The octokit instance you want is the **installation-scoped** one from the webhook handler's destructured argument, NOT a global client — installation auth is what gives you write access to the target repo.

**Task 6 — Azure deploy.** ~1-2 hours.

`az webapp create` against a Linux Node 20 plan. Deployment Center → GitHub source → main branch. Set env vars: `APP_ID`, `PRIVATE_KEY` (the .pem contents, base64-encoded), `WEBHOOK_SECRET`, `WEBSITES_PORT=3000`. Update the GitHub App's webhook URL from the smee.io URL to the Azure URL. Test with a real PR merge.

**Task 7 — Mode 3 heatmap.** ~3-4 hours.

Smaller scope than the spec — for the demo, render the heatmap from `pr_history.json` directly with the seeded `investigation_override` fields. Don't build the live pipeline that watches for new merges and re-renders; that's post-hackathon work.

That's roughly 12-14 hours of focused work. Tight but doable in 24 hours of calendar time if uninterrupted.

---

## Things I'd tell a teammate over coffee

**Don't build a perfect tool registration system.** The Copilot SDK probably has its own tool API. Find the one method on `session` that accepts a tool definition (look for `addTool`, `registerTool`, or a `tools` array in `createSession` options). Use it. Don't roll your own dispatcher.

**The 8000-token investigation budget from the Mode 1 spec is tight.** First time through, you'll blow it. Don't optimize prompts until after Task 4 — get a working pipeline first, then trim. The compression trick (Haiku for tool-output summarization) buys back most of the budget.

**Mode 2's drift-flag detection is mostly a prompting problem, not an algorithmic one.** Give the map agent the README contents AND the import graph and ask it explicitly: "Does the README mention every dependency the code uses?" The two seeded drift flags in Lunchducks (`undocumented_dependency` on payment→auth, `missing_deploy_workflow` on api-gateway) will fall out naturally.

**The demo time anchor is `2026-04-22T01:48:00Z`.** Either shift all fixture timestamps before demoing, or inject an offset at fixture-load time so "incident time" is always "now − 5 minutes." The second approach is 30 lines of code and saves you from rewriting JSON before every rehearsal.

**Investigation ID generation matters more than you'd think.** Use `crypto.randomUUID()`, not `Date.now()`. If two webhooks fire within the same millisecond (it happens during a deploy with multiple merge commits), Date-based IDs collide and your SSE streams cross-contaminate.

**The dashboard does not need authentication for the demo.** Don't add login. We are not going to have time. If a judge asks, "we'd front this with the GitHub App's user OAuth flow in production" is a fine answer.

**SSE on Azure App Service.** Azure has a 230-second idle timeout. Send `: keepalive\n\n` every 15 seconds. Without keepalives, long-running investigations will drop their stream halfway through the demo. Don't ask how I know.

---

## Open questions to resolve before submission

1. **Does the Copilot SDK consume premium requests for sub-agent calls?** If yes, watch budget during rehearsals. BYOK with Anthropic API key is the documented fallback.
2. **What's the SDK's actual streaming method?** Verify with `Object.keys(session)` on a live session before writing `teeAgentCall`. Adjust the iterator accordingly.
3. **Does the SDK propagate tool definitions to child sessions automatically?** If not, we need to register the same tool set on each child session at creation time. One extra line per child spawn.
4. **GitHub App rate limits at investigation time.** A single Mode 1 investigation makes ~6-10 GitHub API calls. We're well under the 5000/hour App rate limit but watch for surprises during the demo if rehearsals run back-to-back.

---

## Files in this repo worth reading first, in order

1. `README.md` — project overview
2. `fixtures/README.md` — what the seeded data is and why
3. `src/orchestrator/investigation.ts` — Mode 1 entry point, currently the most complete code
4. `src/orchestrator/service-map.ts` — Mode 2 entry point
5. `src/lib/copilot.ts` — SDK client setup, the place you'll be most often
6. The three `.docx` spec files in `/docs` — authoritative on what each mode must do

The orchestrator files have TODO comments where streaming integration belongs. Search for `// STREAMING:` to find them.

---

*Good luck. The hard part is done. The remaining work is plumbing.*