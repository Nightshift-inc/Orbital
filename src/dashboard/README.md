# dashboard

Merchant-facing web UI for the Orbital subscription commerce platform.
Built with Next.js 14 (app router) and Tailwind.

## Responsibilities

- Landing page for new tenants
- Overview dashboard showing MRR, active subscriptions, failed charges
- Invoices list and detail views
- Settings (tenant profile, API key management, webhook configuration)

## Runtime topology

The dashboard is a **pure client service**. It has no direct access to the
database, Redis, or third-party integrations. Every piece of data it renders
comes from api-gateway.

Dependencies:

- **api-gateway** — all data fetches and user auth go through this service.
  The fetch calls live in `lib/api-client.ts`.
- Environment: `ORBITAL_API_URL`, `NEXT_PUBLIC_ORBITAL_API_URL`

## Entry points

| File                          | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `app/layout.tsx`              | Root layout, nav, global styles                 |
| `app/page.tsx`                | Landing page                                    |
| `app/dashboard/page.tsx`      | Merchant overview (MRR, subs, failed charges)   |
| `app/invoices/page.tsx`       | Invoices table view                             |
| `lib/api-client.ts`           | All outbound fetches to api-gateway             |
| `components/Nav.tsx`          | Top navigation bar                              |
| `components/InvoiceTable.tsx` | Invoices table component                        |

## Ownership

Owned by `@frontend-team`. Primary on-call: Slack channel `#orbital-web`.
