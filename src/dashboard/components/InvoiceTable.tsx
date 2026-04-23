import Link from 'next/link';
import { InvoiceSummary } from '../lib/types';

interface Props {
  invoices: InvoiceSummary[];
}

const STATUS_COLORS: Record<string, string> = {
  paid:          'bg-green-900 text-green-300',
  open:          'bg-blue-900 text-blue-300',
  void:          'bg-slate-700 text-slate-400',
  uncollectible: 'bg-red-900 text-red-300',
  draft:         'bg-yellow-900 text-yellow-300',
};

export function InvoiceTable({ invoices }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="border-b border-slate-700 text-left text-slate-400">
        <tr>
          <th className="py-2">Invoice</th>
          <th className="py-2">Tenant</th>
          <th className="py-2">Amount</th>
          <th className="py-2">Due</th>
          <th className="py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
            <td className="py-3">
              <Link href={`/invoices/${inv.id}`} className="font-mono text-blue-400 hover:underline">
                {inv.id}
              </Link>
            </td>
            <td className="py-3">{inv.tenant_name}</td>
            <td className="py-3">
              {inv.currency} {(inv.total_cents / 100).toFixed(2)}
            </td>
            <td className="py-3 text-slate-400">{inv.due_date}</td>
            <td className="py-3">
              <span className={`rounded px-2 py-0.5 text-xs uppercase ${STATUS_COLORS[inv.status] ?? 'bg-slate-800 text-slate-300'}`}>
                {inv.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
