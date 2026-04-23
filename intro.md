Here's the Orbital handoff brief for Claude Code.

Project: Orbital — demo target repo for the Blackbox hackathon
What it is. A realistic-looking B2B SaaS subscription commerce platform. Four services in a monorepo. It's the target of investigation, not the thing being built in the hackathon. Its job is to exist on GitHub and look plausible to judges.
Location. ~/Development/night-shift/Orbital/orbital/ (or wherever the user cd's into — that's the repo root with package.json, docker-compose.yml, and src/ directly inside).
Services:

src/auth/ — Express TypeScript, session management (leaf, no outbound deps)
src/payment/ — Express TypeScript, billing, calls auth-service
src/gateway/ — Express TypeScript, public API, calls both
src/dashboard/ — Next.js 14 (app router) + Tailwind, calls gateway

Known issues to fix:

Backend services don't Docker-build — the Dockerfiles run npm run build which invokes tsc, but src/auth/, src/payment/, src/gateway/ are missing tsconfig.json. Fix: add per-service tsconfigs (target ES2022, module commonjs, strict, esModuleInterop, skipLibCheck, outDir dist, include **/*.ts).
No .dockerignore files — host node_modules/ can pollute Docker build context. Fix: add .dockerignore in each service directory with node_modules, dist, .next, .env*.
Dashboard data pages show empty states — /dashboard and /invoices fetch from api-gateway's /api/metrics, /api/invoices, /api/subscriptions endpoints that don't exist. Two ways to fix; pick one: either add mock response handlers in src/gateway/router.ts, or add a mock-mode flag in src/dashboard/lib/api-client.ts that returns hardcoded SaaS-looking numbers (MRR ~$47k, ~140 active subs, a handful of failed charges).
docker-compose.yml has a deprecated version: "3.9" line — Compose v2 warns on it. Delete the first two lines.

Files that must not be modified (demo-critical line numbers):

src/auth/middleware.ts:43 — buggy sessionCookie.session_token deref
src/auth/token.ts:17 — downstream call
src/payment/auth-client.ts:12 — fetch to auth, edge evidence
src/gateway/router.ts:34 — authClient.verify(...) call, edge evidence
src/gateway/router.ts:89 — Express error handler, stack frame target

When adding new routes to src/gateway/router.ts for the dashboard mocks, add them below line 89 or in a new file to avoid shifting anything critical.
Intentional "bugs" to preserve (they're seeds for the Blackbox demo — do not fix):

src/payment/README.md makes zero mention of auth-service, despite src/payment/auth-client.ts calling it. Keep it that way.
No .github/workflows/deploy-gateway.yml exists. Don't add one.

Running it:
npm install          # monorepo install, covers all workspaces
npm run dev:auth     # :4001
npm run dev:payment  # :4002
npm run dev:gateway  # :4000
npm run dev:dashboard# :4003
The dev:* scripts use tsx watch which handles TypeScript without a build step. Docker is optional.
What "done" looks like for Orbital:

All four npm run dev:* commands start without errors
curl localhost:4000/health, :4001/health, :4002/health return {status: "ok"}
open http://localhost:4003 — landing page, /dashboard, and /invoices all render without crashes, with mock-looking SaaS data on the two inner pages
docker compose up builds cleanly from a fresh clone (after tsconfig + dockerignore fixes)
Repo is pushed to a public GitHub repo so the Blackbox project can read from it

Explicit non-goals (to prevent scope creep):

Real authentication, real session cookies, real database queries
Real Stripe integration
Any interactive forms or persistent state
Tests
CI beyond what's already in .github/workflows/ci.yml

Docs to read first: README.md (Orbital product README) and docs/architecture.md (service topology and data flow). Both are in the repo root.