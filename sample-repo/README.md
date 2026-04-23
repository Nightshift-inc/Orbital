# Orbital

> Subscription commerce infrastructure for B2B SaaS companies.

Handle trials, seat-based billing, usage metering, and dunning without
building it yourself. Orbital is the recurring-revenue plumbing that lets
SaaS teams ship billing features in days instead of quarters.

[![CI](https://img.shields.io/badge/CI-passing-green)](./.github/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Node](https://img.shields.io/badge/node-20%2B-brightgreen)](./package.json)

---

## What Orbital does

- **Subscriptions** — Create plans, trial flows, and proration rules via a
  single REST API. Orbital handles the state machine.
- **Metered billing** — Report usage events, Orbital rolls them up into
  invoices on period close.
- **Dunning** — Failed charges retry on a configurable schedule (1d, 3d, 7d, 14d).
- **Invoicing** — PDF invoices generated on demand or on period close.
- **Merchant integrations** — Every capability exposed via a signed REST
  API with idempotency keys and per-tier rate limiting.
- **Merchant dashboard** — A Next.js web UI for managing subscriptions,
  invoices, and API keys without touching the API directly.

## Architecture at a glance

Orbital runs as four independently deployable services:

```
          ┌─────────────┐
          │  Customer   │
          │  (browser)  │
          └──────┬──────┘
                 │ HTTPS
                 ▼
          ┌─────────────┐
          │  dashboard  │  ◀─── Next.js merchant UI
          └──────┬──────┘
                 │
                 ▼
          ┌─────────────┐
          │ api-gateway │  ◀─── public API, rate limits, auth check
          └──┬───────┬──┘
             │       │
             ▼       ▼
       ┌──────────┐ ┌────────────────┐
       │   auth-  │ │    payment-    │
       │  service │◀┤    gateway     │  ◀── billing, charges, invoices
       └──────────┘ └────────────────┘
```

See [`docs/architecture.md`](./docs/architecture.md) for service boundaries,
data flow diagrams, and the reasoning behind the split.

## Services in this monorepo

| Service           | Directory         | Owner           | Description                                       |
| ----------------- | ----------------- | --------------- | ------------------------------------------------- |
| dashboard         | `src/dashboard/`  | `@frontend-team`| Merchant-facing Next.js UI                        |
| api-gateway       | `src/gateway/`    | `@platform-team`| Public REST API, rate limiter, request routing    |
| auth-service      | `src/auth/`       | `@auth-team`    | Session management, API keys, tenant isolation    |
| payment-gateway   | `src/payment/`    | `@payments-team`| Charge capture, invoices, dunning, webhooks       |

## Quickstart

### Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres and Redis)

### Run the stack

```bash
git clone https://github.com/orbital-labs/orbital.git
cd orbital

cp .env.example .env
docker compose up -d        # Postgres, Redis, and all four services
```

Or run services individually:

```bash
npm install
npm run dev:auth            # http://localhost:4001
npm run dev:payment         # http://localhost:4002
npm run dev:gateway         # http://localhost:4000
npm run dev:dashboard       # http://localhost:4003
```

### Sanity check

```bash
curl http://localhost:4000/health
# {"status":"ok","service":"api-gateway"}

open http://localhost:4003   # Opens the dashboard
```

## Development

### Project layout

```
.
├── docs/                  ← architecture docs
├── src/
│   ├── auth/              ← auth-service (leaf)
│   ├── payment/           ← payment-gateway (calls auth)
│   ├── gateway/           ← api-gateway (calls auth + payment)
│   └── dashboard/         ← Next.js merchant UI (calls gateway)
├── .github/workflows/     ← per-service deploy pipelines
├── docker-compose.yml
├── .env.example
├── CHANGELOG.md
└── LICENSE
```

### Each service ships independently

Services are deployed via path-filtered GitHub Actions workflows. A change to
`src/auth/**` triggers only `.github/workflows/deploy-auth.yml`. Same for
dashboard, payment-gateway, and (soon) api-gateway. This keeps blast radius
small and lets each team ship on their own cadence.

## Observability

Every backend service emits:

- `/health` — liveness probe
- `/metrics` — Prometheus scrape endpoint
- Structured JSON logs on stdout — the gateway attaches a `request_id` that
  propagates through to auth-service and payment-gateway for tracing

Incidents and deploy correlation are tracked via **Blackbox**, a separate
internal tool that watches this repo and correlates merged PRs against
production error signals. If you get paged, check the Blackbox dashboard
first.

## Contributing

1. Pick up a ticket from the team roadmap
2. Branch from `main`, name your branch `team/description`
3. Open a PR — `ci.yml` runs lint and tests for all services
4. Get a review from a CODEOWNER for the directory you touched
5. Squash-merge when approved

See [CHANGELOG.md](./CHANGELOG.md) for the release history.

## License

MIT. See [LICENSE](./LICENSE).

---

*Orbital Labs, Inc. — recurring revenue, refactored.*
