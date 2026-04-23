import { Router, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Demo data — self-contained. No DB, no auth. Anchored to 2026-04-22.
// Amounts in cents unless noted. Designed so numbers add up:
//   MRR $47,320  =  142 subs across four plans (see /api/metrics).
// Eight "failed charges last 7 days" — 2 of them are authentication_failed,
// a subtle narrative hook to the Mode 1 auth-middleware incident.
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-22T01:48:00Z');

const CUSTOMERS = [
  { id: 't_lumen',    name: 'Lumen Labs',          plan: 'Growth',     mrr: 49900,  seats: 12, signed_up: '2025-07-15', region: 'US', status: 'active' },
  { id: 't_halcyon',  name: 'Halcyon Systems',     plan: 'Scale',      mrr: 199900, seats: 48, signed_up: '2024-11-02', region: 'US', status: 'active' },
  { id: 't_meridian', name: 'Meridian Health',     plan: 'Enterprise', mrr: 348000, seats: 120, signed_up: '2024-03-21', region: 'US', status: 'active' },
  { id: 't_strata',   name: 'Strata Data',         plan: 'Growth',     mrr: 49900,  seats: 18, signed_up: '2025-09-30', region: 'UK', status: 'active' },
  { id: 't_corvus',   name: 'Corvus Analytics',    plan: 'Scale',      mrr: 199900, seats: 36, signed_up: '2025-01-18', region: 'US', status: 'active' },
  { id: 't_verity',   name: 'Verity Finance',      plan: 'Enterprise', mrr: 598000, seats: 210, signed_up: '2023-11-09', region: 'US', status: 'active' },
  { id: 't_polaris',  name: 'Polaris Robotics',    plan: 'Scale',      mrr: 199900, seats: 42, signed_up: '2025-04-11', region: 'EU', status: 'active' },
  { id: 't_nexus',    name: 'Nexus Cloud',         plan: 'Growth',     mrr: 49900,  seats: 22, signed_up: '2025-12-02', region: 'US', status: 'active' },
  { id: 't_ember',    name: 'Ember Studios',       plan: 'Starter',    mrr: 9900,   seats: 4,  signed_up: '2026-02-14', region: 'US', status: 'active' },
  { id: 't_arbor',    name: 'Arbor Media',         plan: 'Growth',     mrr: 49900,  seats: 14, signed_up: '2025-08-28', region: 'CA', status: 'active' },
  { id: 't_foundry',  name: 'Foundry Works',       plan: 'Scale',      mrr: 199900, seats: 31, signed_up: '2024-09-17', region: 'US', status: 'active' },
  { id: 't_harbor',   name: 'Harbor Logistics',    plan: 'Growth',     mrr: 49900,  seats: 25, signed_up: '2025-05-06', region: 'US', status: 'active' },
  { id: 't_keystone', name: 'Keystone Legal',      plan: 'Enterprise', mrr: 420000, seats: 145, signed_up: '2024-06-22', region: 'US', status: 'active' },
  { id: 't_summit',   name: 'Summit HR',           plan: 'Growth',     mrr: 49900,  seats: 19, signed_up: '2025-10-11', region: 'AU', status: 'active' },
  { id: 't_cadence',  name: 'Cadence Music',       plan: 'Starter',    mrr: 9900,   seats: 3,  signed_up: '2026-03-01', region: 'UK', status: 'trialing' },
  { id: 't_drift',    name: 'Drift Labs',          plan: 'Growth',     mrr: 49900,  seats: 11, signed_up: '2025-06-19', region: 'US', status: 'past_due' },
  { id: 't_prism',    name: 'Prism Insights',      plan: 'Scale',      mrr: 199900, seats: 28, signed_up: '2024-12-14', region: 'EU', status: 'active' },
  { id: 't_blaze',    name: 'Blaze Networks',      plan: 'Starter',    mrr: 9900,   seats: 5,  signed_up: '2026-04-02', region: 'US', status: 'trialing' },
  { id: 't_atlas',    name: 'Atlas Commerce',      plan: 'Enterprise', mrr: 275000, seats: 88, signed_up: '2024-08-05', region: 'US', status: 'active' },
  { id: 't_kairos',   name: 'Kairos AI',           plan: 'Starter',    mrr: 9900,   seats: 6,  signed_up: '2026-03-18', region: 'US', status: 'active' },
];

// Recent invoices — mix of paid / open / overdue / void.
// Issued dates clustered around the current demo week for visual freshness.
let INVOICES: {
  id: string; tenant: string; total_cents: number;
  status: string; due: string; issued: string;
}[] = [
  { id: 'inv_2604_0142', tenant: 't_meridian', total_cents: 348000, status: 'paid',     due: '2026-04-15', issued: '2026-04-01' },
  { id: 'inv_2604_0141', tenant: 't_verity',   total_cents: 598000, status: 'paid',     due: '2026-04-10', issued: '2026-03-25' },
  { id: 'inv_2604_0140', tenant: 't_keystone', total_cents: 420000, status: 'paid',     due: '2026-04-18', issued: '2026-04-04' },
  { id: 'inv_2604_0139', tenant: 't_atlas',    total_cents: 275000, status: 'paid',     due: '2026-04-20', issued: '2026-04-05' },
  { id: 'inv_2604_0138', tenant: 't_halcyon',  total_cents: 199900, status: 'paid',     due: '2026-04-12', issued: '2026-03-28' },
  { id: 'inv_2604_0137', tenant: 't_corvus',   total_cents: 199900, status: 'paid',     due: '2026-04-14', issued: '2026-03-30' },
  { id: 'inv_2604_0136', tenant: 't_polaris',  total_cents: 199900, status: 'paid',     due: '2026-04-16', issued: '2026-04-02' },
  { id: 'inv_2604_0135', tenant: 't_foundry',  total_cents: 199900, status: 'paid',     due: '2026-04-11', issued: '2026-03-27' },
  { id: 'inv_2604_0134', tenant: 't_prism',    total_cents: 199900, status: 'paid',     due: '2026-04-19', issued: '2026-04-05' },
  { id: 'inv_2604_0133', tenant: 't_lumen',    total_cents: 49900,  status: 'paid',     due: '2026-04-17', issued: '2026-04-03' },
  { id: 'inv_2604_0132', tenant: 't_strata',   total_cents: 49900,  status: 'paid',     due: '2026-04-13', issued: '2026-03-29' },
  { id: 'inv_2604_0131', tenant: 't_nexus',    total_cents: 49900,  status: 'paid',     due: '2026-04-21', issued: '2026-04-07' },
  { id: 'inv_2604_0130', tenant: 't_arbor',    total_cents: 49900,  status: 'paid',     due: '2026-04-09', issued: '2026-03-26' },
  { id: 'inv_2604_0129', tenant: 't_harbor',   total_cents: 49900,  status: 'paid',     due: '2026-04-22', issued: '2026-04-08' },
  { id: 'inv_2604_0128', tenant: 't_summit',   total_cents: 49900,  status: 'paid',     due: '2026-04-06', issued: '2026-03-23' },
  { id: 'inv_2604_0127', tenant: 't_ember',    total_cents: 9900,   status: 'paid',     due: '2026-04-08', issued: '2026-03-25' },
  { id: 'inv_2604_0126', tenant: 't_kairos',   total_cents: 9900,   status: 'paid',     due: '2026-04-18', issued: '2026-04-04' },
  { id: 'inv_2605_0154', tenant: 't_lumen',    total_cents: 49900,  status: 'open',     due: '2026-05-17', issued: '2026-04-17' },
  { id: 'inv_2605_0153', tenant: 't_strata',   total_cents: 49900,  status: 'open',     due: '2026-05-13', issued: '2026-04-13' },
  { id: 'inv_2605_0152', tenant: 't_nexus',    total_cents: 49900,  status: 'open',     due: '2026-05-21', issued: '2026-04-21' },
  { id: 'inv_2605_0151', tenant: 't_halcyon',  total_cents: 199900, status: 'open',     due: '2026-05-12', issued: '2026-04-12' },
  { id: 'inv_2605_0150', tenant: 't_meridian', total_cents: 348000, status: 'open',     due: '2026-05-15', issued: '2026-04-15' },
  { id: 'inv_2604_0125', tenant: 't_drift',    total_cents: 49900,  status: 'uncollectible', due: '2026-03-28', issued: '2026-03-14' },
  { id: 'inv_2604_0124', tenant: 't_drift',    total_cents: 49900,  status: 'uncollectible', due: '2026-04-14', issued: '2026-03-31' },
  { id: 'inv_2603_0099', tenant: 't_ember',    total_cents: 9900,   status: 'void',     due: '2026-03-22', issued: '2026-03-08' },
];

const RECENT_FAILED_CHARGES = [
  { id: 'ch_f001', tenant: 't_drift',    amount_cents: 49900,  reason: 'card_declined',         occurred_at: '2026-04-16T09:12:00Z' },
  { id: 'ch_f002', tenant: 't_drift',    amount_cents: 49900,  reason: 'card_declined',         occurred_at: '2026-04-17T14:30:00Z' },
  { id: 'ch_f003', tenant: 't_cadence',  amount_cents: 9900,   reason: 'insufficient_funds',    occurred_at: '2026-04-19T22:05:00Z' },
  { id: 'ch_f004', tenant: 't_ember',    amount_cents: 9900,   reason: 'expired_card',          occurred_at: '2026-04-20T11:45:00Z' },
  { id: 'ch_f005', tenant: 't_kairos',   amount_cents: 9900,   reason: 'card_declined',         occurred_at: '2026-04-21T16:20:00Z' },
  { id: 'ch_f006', tenant: 't_blaze',    amount_cents: 9900,   reason: 'insufficient_funds',    occurred_at: '2026-04-21T18:55:00Z' },
  { id: 'ch_f007', tenant: 't_nexus',    amount_cents: 49900,  reason: 'authentication_failed', occurred_at: '2026-04-22T01:49:00Z' },
  { id: 'ch_f008', tenant: 't_lumen',    amount_cents: 49900,  reason: 'authentication_failed', occurred_at: '2026-04-22T01:52:00Z' },
];

function nameOf(tenantId: string): string {
  return CUSTOMERS.find((c) => c.id === tenantId)?.name ?? tenantId;
}

// ---------------------------------------------------------------------------

export const stubRoutes = Router();

stubRoutes.get('/api/metrics', (_req: Request, res: Response) => {
  res.json({
    mrr_cents: 4732000,
    mrr_history: [
      { month: '2025-11', mrr_cents: 3540000 },
      { month: '2025-12', mrr_cents: 3820000 },
      { month: '2026-01', mrr_cents: 4080000 },
      { month: '2026-02', mrr_cents: 4350000 },
      { month: '2026-03', mrr_cents: 4590000 },
      { month: '2026-04', mrr_cents: 4732000 },
    ],
    active_subscriptions: 142,
    trial_subscriptions: 14,
    failed_charges_last_7d: RECENT_FAILED_CHARGES.length,
    churn_rate_30d: 2.3,
    new_signups_this_month: 7,
    trial_conversion_rate_pct: 62.0,
    as_of: NOW.toISOString(),
  });
});

stubRoutes.get('/api/subscriptions', (_req: Request, res: Response) => {
  const subs = CUSTOMERS.map((c, i) => ({
    id: `sub_${c.id.slice(2)}_${(1000 + i).toString()}`,
    tenant_id: c.id,
    tenant_name: c.name,
    plan_name: c.plan,
    price_cents: c.mrr,
    status: c.status,
    current_period_start: '2026-04-01',
    current_period_end: '2026-05-01',
    seat_count: c.seats,
    created_at: c.signed_up,
  }));
  res.json({
    subscriptions: subs,
    total: 142,
    showing: subs.length,
  });
});

stubRoutes.get('/api/customers', (_req: Request, res: Response) => {
  const customers = CUSTOMERS.map((c) => ({
    id: c.id,
    name: c.name,
    contact_email: `billing@${c.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    signed_up_at: c.signed_up,
    plan: c.plan,
    mrr_contribution_cents: c.mrr,
    status: c.status,
    region: c.region,
    seats: c.seats,
  }));
  res.json({
    customers,
    total: customers.length,
  });
});

stubRoutes.get('/api/invoices', (_req: Request, res: Response) => {
  const out = INVOICES.map((inv) => ({
    id: inv.id,
    tenant_name: nameOf(inv.tenant),
    total_cents: inv.total_cents,
    currency: 'USD' as const,
    due_date: inv.due,
    status: inv.status,
    issued_at: inv.issued,
  }));
  res.json(out);
});

stubRoutes.get('/api/invoices/:id', (req: Request, res: Response) => {
  const inv = INVOICES.find((i) => i.id === req.params.id);
  if (!inv) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json({
    id: inv.id,
    tenant_name: nameOf(inv.tenant),
    total_cents: inv.total_cents,
    currency: 'USD',
    due_date: inv.due,
    status: inv.status,
    issued_at: inv.issued,
  });
});

stubRoutes.get('/api/settings', (_req: Request, res: Response) => {
  res.json({
    tenant_id: 't_orbital_demo',
    company_name: 'Orbital Labs Demo',
    billing_email: '[email protected]',
    timezone: 'America/New_York',
    api_keys: [
      {
        id: 'key_live_01hnq9x',
        prefix: 'sk_live_abc4F2',
        masked_suffix: '•••••••••••k9Zw',
        created_at: '2025-11-03T14:22:00Z',
        last_used_at: '2026-04-22T01:47:15Z',
        scopes: ['charges:write', 'subscriptions:write', 'invoices:read'],
      },
      {
        id: 'key_live_01hnq9y',
        prefix: 'sk_live_x7M1qP',
        masked_suffix: '•••••••••••v3Jc',
        created_at: '2026-02-15T09:10:00Z',
        last_used_at: '2026-04-21T22:03:44Z',
        scopes: ['charges:read', 'invoices:read'],
      },
    ],
    webhooks: [
      {
        id: 'wh_01hnrabc',
        url: 'https://api.lumen-labs.com/webhooks/orbital',
        events: ['subscription.created', 'subscription.updated', 'invoice.paid', 'charge.failed'],
        status: 'active',
        created_at: '2025-11-04T10:00:00Z',
      },
      {
        id: 'wh_01hnrdef',
        url: 'https://ops.halcyon.systems/billing-hooks',
        events: ['charge.failed', 'subscription.canceled'],
        status: 'active',
        created_at: '2026-01-12T16:45:00Z',
      },
    ],
    team_members: [
      { email: '[email protected]',     name: 'Jamie Lee',       role: 'owner' },
      { email: '[email protected]',  name: 'Nora Chen',       role: 'admin' },
      { email: '[email protected]',  name: 'Rahul Singh',     role: 'admin' },
      { email: '[email protected]',     name: 'Mike Kim',        role: 'member' },
      { email: '[email protected]',    name: 'Priya Ramirez',   role: 'member' },
    ],
  });
});

stubRoutes.get('/api/failed-charges', (_req: Request, res: Response) => {
  const out = RECENT_FAILED_CHARGES.map((c) => ({
    ...c,
    tenant_name: nameOf(c.tenant),
  }));
  res.json(out);
});

interface CreateInvoiceBody {
  tenant_id: string;
  amount_cents: number;
  currency?: string;
  due_date: string;
}

stubRoutes.post('/api/invoices', (req: Request, res: Response) => {
  const { tenant_id, amount_cents, currency = 'USD', due_date } = req.body as CreateInvoiceBody;

  if (!tenant_id || !amount_cents || !due_date) {
    res.status(400).json({ error: 'tenant_id, amount_cents, and due_date are required' });
    return;
  }

  const issued = new Date().toISOString().slice(0, 10);
  const id = `inv_created_${Date.now()}`;

  const invoice = { id, tenant: tenant_id, total_cents: amount_cents, status: 'open', due: due_date, issued };
  INVOICES = [...INVOICES, invoice];

  res.status(201).json({
    id,
    tenant_name: nameOf(tenant_id),
    total_cents: amount_cents,
    currency,
    due_date,
    status: 'open' as const,
    issued_at: issued,
  });
});