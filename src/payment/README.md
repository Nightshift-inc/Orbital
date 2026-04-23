# payment-gateway

Recurring billing, charge capture, invoice generation, and webhook dispatch
for the Orbital subscription commerce platform.

## Responsibilities

- Capture one-time and recurring charges via Stripe
- Generate PDF invoices on subscription period boundaries
- Run dunning retry schedules for failed charges (1d, 3d, 7d, 14d)
- Dispatch webhooks to merchants on subscription lifecycle events
- Reconcile Stripe payout events against the Orbital ledger

## Runtime topology

Dependencies:

- **Stripe API** — charge capture, card vault, webhook verification
- **Postgres** — invoice records, charge history, dunning state machine
- Environment: `PAYMENT_SERVICE_PORT`, `STRIPE_API_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`

See `.env.example` for the full list.

## Entry points

| File                      | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `index.ts`                | Express app bootstrap, mounts routes             |
| `payment-processor.ts`    | Core `processPayment()` orchestration            |
| `stripe-client.ts`        | Thin wrapper around the Stripe SDK               |
| `invoice-generator.ts`    | Builds `Invoice` objects from line items         |
| `types.ts`                | Shared interfaces: `Charge*`, `Invoice`, etc.    |

## HTTP surface

| Method | Path         | Description                               |
| ------ | ------------ | ----------------------------------------- |
| POST   | `/charge`    | Captures a charge against a stored card   |
| POST   | `/refund`    | Issues a partial or full refund           |
| POST   | `/webhooks`  | Receives Stripe webhook events            |
| GET    | `/invoices`  | Lists invoices for the current tenant     |
| GET    | `/health`    | Liveness probe                            |

## Ownership

Owned by `@payments-team`. Primary on-call: Slack channel `#orbital-billing`.
PCI compliance contact: `@finance-eng-lead`.
