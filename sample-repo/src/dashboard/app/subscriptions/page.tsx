import { listSubscriptions } from '../../lib/api-client';
import type { Subscription } from '../../lib/types';

export const dynamic = 'force-dynamic';

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const statusStyles: Record<Subscription['status'], string> = {
  active:    'bg-emerald-950 text-emerald-300',
  trialing:  'bg-sky-950 text-sky-300',
  past_due:  'bg-amber-950 text-amber-300',
  canceled:  'bg-slate-800 text-slate-400',
};

export default async function SubscriptionsPage() {
  const sessionToken = process.env.ORBITAL_DEMO_TOKEN ?? '';

  let data;
  try {
    data = await listSubscriptions(sessionToken);
  } catch {
    data = { subscriptions: [], total: 0, showing: 0 };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-400">
            Showing {data.showing} of {data.total.toLocaleString()} active subscriptions
          </p>
        </div>
        <button className="rounded bg-orbital-primary px-4 py-2 text-sm text-white hover:bg-blue-700">
          + New subscription
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-slate-700 text-left text-slate-400">
          <tr>
            <th className="py-2">Tenant</th>
            <th className="py-2">Plan</th>
            <th className="py-2">Seats</th>
            <th className="py-2">MRR</th>
            <th className="py-2">Period</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.subscriptions.map((s) => (
            <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-900/50">
              <td className="py-3">
                <div className="text-slate-100">{s.tenant_name}</div>
                <div className="font-mono text-xs text-slate-500">{s.id}</div>
              </td>
              <td className="py-3 text-slate-300">{s.plan_name}</td>
              <td className="py-3 text-slate-300">{s.seat_count}</td>
              <td className="py-3 text-slate-200">{dollars(s.price_cents)}/mo</td>
              <td className="py-3 text-slate-400">
                {s.current_period_start} → {s.current_period_end}
              </td>
              <td className="py-3">
                <span className={`rounded px-2 py-0.5 text-xs uppercase ${statusStyles[s.status]}`}>
                  {s.status.replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
