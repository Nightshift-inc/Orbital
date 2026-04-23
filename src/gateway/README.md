# api-gateway

Public-facing HTTP entry point for the Orbital subscription commerce
platform. Terminates TLS in production, applies per-tenant rate limits,
authenticates every request, and routes to the correct internal service.

## Responsibilities

- Accept inbound HTTP from merchant integrations and the Orbital dashboard
- Enforce per-tier rate limits (Free / Starter / Growth / Scale)
- Authenticate requests by delegating to `auth-service`
- Route checkout flows through `payment-gateway`
- Attach a `request_id` to every request and propagate it downstream
- Surface downstream errors in a consistent JSON envelope

## Runtime topology

Dependencies:

- **auth-service** — `POST /token/validate` on every non-public request
- **payment-gateway** — `POST /charge` for checkout flows, `POST /refund`
  for refund requests
- Environment: `GATEWAY_PORT`, `AUTH_SERVICE_URL`, `PAYMENT_SERVICE_URL`,
  `RATE_LIMIT_FREE`, `RATE_LIMIT_STARTER`, `RATE_LIMIT_GROWTH`,
  `RATE_LIMIT_SCALE`

See `.env.example` for the full list.

## Entry points

| File                              | Purpose                                       |
| --------------------------------- | --------------------------------------------- |
| `index.ts`                        | Express app bootstrap                         |
| `router.ts`                       | Public route definitions and error handler    |
| `middleware/rate-limiter.ts`      | Per-tenant, per-tier rate limit enforcement   |
| `middleware/request-logger.ts`    | Request ID propagation and structured logging |
| `types.ts`                        | Shared interfaces                             |

## HTTP surface

| Method | Path                | Description                          |
| ------ | ------------------- | ------------------------------------ |
| POST   | `/api/auth/login`   | Verifies credentials, issues session |
| POST   | `/api/checkout`     | Auth check + delegated charge        |
| GET    | `/api/subscriptions`| Tenant subscription list             |
| GET    | `/health`           | Liveness probe                       |

## Ownership

Owned by `@platform-team`. Primary on-call: Slack channel `#orbital-platform`.
