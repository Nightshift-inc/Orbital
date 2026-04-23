import { getMetrics } from '../../lib/api-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sessionToken = process.env.ORBITAL_DEMO_TOKEN ?? '';

  let metrics;
  try {
    metrics = await getMetrics(sessionToken);
  } catch {
    metrics = {
      mrr_cents: 0,
      active_subscriptions: 0,
      trial_subscriptions: 0,
      failed_charges_last_7d: 0,
      churn_rate_30d: 0,
    };
  }

  const cards = [
    { label: 'MRR',                    value: `$${(metrics.mrr_cents / 100).toLocaleString()}` },
    { label: 'Active subscriptions',   value: metrics.active_subscriptions.toLocaleString() },
    { label: 'Trials',                 value: metrics.trial_subscriptions.toLocaleString() },
    { label: 'Failed charges (7d)',    value: metrics.failed_charges_last_7d.toLocaleString() },
    { label: '30d churn',              value: `${metrics.churn_rate_30d.toFixed(1)}%` },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg bg-orbital-surface p-4"
          >
            <div className="text-xs uppercase text-slate-400">{c.label}</div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
