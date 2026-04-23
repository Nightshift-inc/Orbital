import { listCustomers } from '../../lib/api-client';
import type { Customer } from '../../lib/types';

export const dynamic = 'force-dynamic';

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const statusStyles: Record<Customer['status'], string> = {
  active:    'bg-emerald-950 text-emerald-300',
  trialing:  'bg-sky-950 text-sky-300',
  past_due:  'bg-amber-950 text-amber-300',
  canceled:  'bg-slate-800 text-slate-400',
};

export default async function CustomersPage() {
  const sessionToken = process.env.ORBITAL_DEMO_TOKEN ?? '';

  let data;
  try {
    data = await listCustomers(sessionToken);
  } catch {
    data = { customers: [], total: 0 };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data.total} customers
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.customers.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-slate-800 bg-orbital-surface p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-medium text-white">{c.name}</div>
                <div className="text-xs text-slate-500">{c.contact_email}</div>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs uppercase ${statusStyles[c.status]}`}>
                {c.status.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-500">Plan</div>
                <div className="text-slate-200">{c.plan}</div>
              </div>
              <div>
                <div className="text-slate-500">Seats</div>
                <div className="text-slate-200">{c.seats}</div>
              </div>
              <div>
                <div className="text-slate-500">MRR</div>
                <div className="text-slate-200">{dollars(c.mrr_contribution_cents)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{c.region}</span>
              <span>Since {c.signed_up_at}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
