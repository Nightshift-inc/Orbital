# Orbital — Architecture Overview

Orbital is built as four independently deployable services. A Next.js
dashboard sits on top, and everything behind it flows through a single
public API gateway. This document describes the service boundaries,
runtime topology, and the reasoning behind the split.

## Service topology

```
                  ┌──────────────────┐
                  │   Customer       │
                  │   (browser)      │
                  └────────┬─────────┘
                           │  HTTPS
                           ▼
                  ┌──────────────────┐
                  │   dashboard      │   :4003  (Next.js)
                  │   (merchant UI)  │
                  └────────┬─────────┘
                           │
                           │  All data fetches
                           ▼
                  ┌──────────────────┐
                  │   api-gateway    │   :4000
                  │   (public API,   │
                  │    rate limiter) │
                  └────┬────────┬────┘
                       │        │
                 ┌─────▼──┐  ┌──▼─────────────┐
                 │  auth- │  │  payment-      │
                 │ service│◀─┤  gateway       │
                 │  :4001 │  │  :4002         │
                 └────┬───┘  └────────┬───────┘
                      │               │
                ┌─────▼───────────────▼─────┐
                │        Postgres           │
                │        Redis              │
                └───────────────────────────┘
```

## Service responsibilities

### dashboard
Next.js 14 app (app router) that renders the merchant-facing UI — landing
page, subscription overview, invoices, settings. All data fetches go
through `lib/api-client.ts` to api-gateway. The dashboard has no direct
access to databases or third-party integrations.

### api-gateway
Public-facing HTTP entry point. Terminates TLS in production, applies
per-tenant rate limits, authenticates requests via auth-service, and routes
billing operations to payment-gateway.

### auth-service
Issues and validates session tokens and tenant API keys. Handles 2FA
enrollment, magic-link login, and password resets. Session data is stored
in Redis with a Postgres audit trail.

### payment-gateway
Owns everything billing. Wraps Stripe for card vaulting and charge capture,
generates PDF invoices, runs dunning jobs for failed charges, and emits
webhooks on subscription lifecycle events.

## Deployment model

Each service deploys independently via its own GitHub Actions workflow
(`.github/workflows/deploy-*.yml`). Deploys are path-filtered — a change to
`src/auth/**` only triggers the auth workflow.

**Known gap:** `api-gateway` has no deploy workflow yet. It currently ships
as part of a monorepo-wide manual process. This is on the roadmap.

## Data flow — customer checkout via dashboard

1. Customer clicks "Subscribe" in the dashboard
2. dashboard POSTs to `/api/checkout` on api-gateway (via `lib/api-client.ts`)
3. api-gateway reads session cookie, calls `auth-service /token/validate`
4. If valid, api-gateway calls `payment-gateway /charge` with the amount
5. payment-gateway calls `auth-service /token/validate` again (defence in depth)
6. payment-gateway captures charge via Stripe and returns charge ID
7. api-gateway returns `{ charge_id }` to the dashboard
8. dashboard renders the confirmation page

## Blast radius — if auth-service fails

- **payment-gateway** fails immediately — every charge calls `validateSession`
- **api-gateway** fails on every non-public route
- **dashboard** fails on every authenticated page load (indirect — via gateway)
