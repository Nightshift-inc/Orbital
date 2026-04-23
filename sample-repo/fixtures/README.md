# Blackbox Fixtures

Seed data for the Blackbox backend. These files drive Mode 1's `get_deploy_log`,
`get_app_errors`, `get_config_changes` tools, Mode 3's performance overlay, and
Mode 3's offline PR history.

The Blackbox backend should read these files on startup and hold them in
memory (Mode 1 §9.3 requires this — no repeated disk reads during a tool call).

## Files

### `deploy_log.json`
Fulfills Mode 1 §3.2. One deploy per service inside the investigation window
(trigger at `2026-04-22T01:48:00Z`, window = trigger − 2h). The `auth-service`
deploy at `01:46:30Z` is the guilty deploy — its SHA matches PR #847's merge
SHA (`e4f2a1c9…`). Two deploys outside the window are included so the window
filter can be exercised.

### `app_errors.json`
Fulfills Mode 1 §3.3. Two error records, both on `auth-service`, both with
stack frames that reference real files and real line numbers in the demo repo:

- `src/auth/middleware.ts:43` — the unsafe `sessionCookie.session_token`
  deref introduced by PR #847.
- `src/auth/token.ts:17` — downstream call site.
- `src/gateway/router.ts:89` — error-handler frame where the exception
  surfaces.

The primary error has `count=847` (≥ 200 threshold per spec). The first
occurrence is 90 seconds after the guilty deploy, giving a 2-minute
temporal delta against PR #847's merge — which lands the top scoring
bracket (40 pts).

### `config_changes.json`
Fulfills Mode 1 §3.4. Exactly two entries:

1. `auth-service` `LOG_ROTATE_INTERVAL` changed 15 seconds before PR #847
   merged. This is the red-herring config change — temporally coincidental
   with the guilty PR (yielding +15 pts in scoring) but unrelated to the
   error stack. The agent should note but not conclude from it.
2. `api-gateway` `RATE_LIMIT_RPS` changed ~90 minutes earlier on an
   unrelated service. Pure noise, tests the agent's filtering.

### `performance_baselines.json`
Fulfills Mode 3 §3.3. Four weeks × three services = 12 records. The
auth-service row tells the core visual story:

| Week  | Baseline ms | Observed ms | Delta      |
| ----- | ----------- | ----------- | ---------- |
| W14   | 42          | 41          | −2% (calm) |
| W15   | 42          | 44          | +5% (calm) |
| W16   | 42          | 51          | +21%       |
| W17   | 42          | 89          | +112%      |

Payment-gateway shows a muted downstream echo of the same pattern
(auth latency propagating through its `validateSession()` call).

### `pr_history.json`
23 PRs across 4 ISO weeks (2026-W14 through 2026-W17) — distributed per
Mode 3 §12.1. Each record mirrors what a real GitHub PR fetch would
return after compression.

Three PRs carry an `investigation_override` field:

- **#825** — `evaluated_clean` (investigated in the past, found innocent)
- **#835** — `suspect` at 45% confidence (a prior near-miss)
- **#847** — `guilty` at 90% confidence (the demo incident)

These overrides exist so Mode 3 can render a meaningful heatmap **before**
the Mode 1 investigation store has accumulated any real investigation
history. In production the investigation store would populate these
fields at runtime; for the demo, use the overrides on startup and let
real Mode 1 investigations replace them as they complete.

## Time anchor

Every timestamp in these fixtures is anchored to the demo trigger time
`2026-04-22T01:48:00Z`. If the demo date shifts, regenerate the fixtures
by shifting all timestamps by the same delta.

## Consistency with the demo repo

The file paths in `app_errors.json` stack frames correspond exactly to
real files in `blackbox-demo-app/`:

- `src/auth/middleware.ts:43` — the `sessionCookie.session_token` line
- `src/auth/token.ts:17` — the `token.split('.')` line
- `src/gateway/router.ts:34` — the auth verify call (edge evidence)
- `src/gateway/router.ts:89` — the Express error handler

This alignment is what makes the Mode 1 code-path-overlap scoring
(+35 pts for PR #847) provable against the actual source.
