'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TENANTS = [
  { id: 't_lumen',    name: 'Lumen Labs' },
  { id: 't_halcyon',  name: 'Halcyon Systems' },
  { id: 't_meridian', name: 'Meridian Health' },
  { id: 't_strata',   name: 'Strata Data' },
  { id: 't_corvus',   name: 'Corvus Analytics' },
  { id: 't_verity',   name: 'Verity Finance' },
  { id: 't_polaris',  name: 'Polaris Robotics' },
  { id: 't_nexus',    name: 'Nexus Cloud' },
  { id: 't_ember',    name: 'Ember Studios' },
  { id: 't_arbor',    name: 'Arbor Media' },
  { id: 't_foundry',  name: 'Foundry Works' },
  { id: 't_harbor',   name: 'Harbor Logistics' },
  { id: 't_keystone', name: 'Keystone Legal' },
  { id: 't_summit',   name: 'Summit HR' },
  { id: 't_cadence',  name: 'Cadence Music' },
  { id: 't_drift',    name: 'Drift Labs' },
  { id: 't_prism',    name: 'Prism Insights' },
  { id: 't_blaze',    name: 'Blaze Networks' },
  { id: 't_atlas',    name: 'Atlas Commerce' },
  { id: 't_kairos',   name: 'Kairos AI' },
];

export function CreateInvoiceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [tenantId, setTenantId] = useState(TENANTS[0].id);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) {
      setError('Enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, amount_cents: cents, currency, due_date: dueDate }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOpen(false);
      setAmount('');
      setDueDate('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        Create invoice
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-orbital-surface p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Create invoice</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Tenant</label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-orbital-bg px-3 py-2 text-sm text-white"
                >
                  {TENANTS.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-slate-400">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full rounded border border-slate-700 bg-orbital-bg px-3 py-2 text-sm text-white placeholder-slate-600"
                  />
                </div>
                <div className="w-28">
                  <label className="mb-1 block text-xs text-slate-400">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-orbital-bg px-3 py-2 text-sm text-white"
                  >
                    {['USD', 'EUR', 'GBP', 'CAD'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full rounded border border-slate-700 bg-orbital-bg px-3 py-2 text-sm text-white"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setError(''); }}
                  className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
