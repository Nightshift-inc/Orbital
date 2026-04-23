# auth-service

Session management, API key issuance, and tenant isolation for the Orbital
subscription commerce platform.

## Responsibilities

- Validate inbound session cookies on every customer request
- Issue, rotate, and revoke signed session tokens
- Validate tenant-scoped API keys for machine-to-machine integrations
- Enforce 2FA enrollment for tenants above the Starter tier
- Maintain an append-only auth audit trail in Postgres

## Runtime topology

auth-service is a **leaf service** in the Orbital topology. It has no
outbound HTTP calls to any other Orbital service. It depends only on:

- **Postgres** — durable audit trail (`auth_events` table)
- **Redis** — hot session cache, 1-hour TTL
- Environment: `AUTH_SERVICE_PORT`, `SESSION_COOKIE_SECRET`,
  `SESSION_TTL_SECONDS`, `DATABASE_URL`, `REDIS_URL`

See `.env.example` for the full list.

## Entry points

| File                      | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| `index.ts`                | Express app bootstrap, mounts middleware and routes       |
| `middleware.ts`           | Global session auth — runs on every non-public request    |
| `token.ts`                | `/token/validate`, `/token/issue`, `/token/revoke` routes |
| `session-store.ts`        | Redis-backed session lookup (demo uses in-memory Map)     |
| `types.ts`                | Shared interfaces: `Session`, `TokenPayload`, etc.        |

## HTTP surface

| Method | Path                | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| POST   | `/token/validate`   | Returns `{ valid, subject, tenant_id }`  |
| POST   | `/token/issue`      | Issues a new session for a verified user |
| POST   | `/token/revoke`     | Revokes a session by ID                  |
| GET    | `/health`           | Liveness probe                           |
| GET    | `/metrics`          | Prometheus scrape endpoint               |

## Known upstream callers

- `payment-gateway` — validates sessions before charge capture
- `api-gateway` — validates sessions on every public API request

## Ownership

Owned by `@auth-team`. Primary on-call: Slack channel `#orbital-auth`.
