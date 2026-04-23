import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getInvoice } from '../../../lib/api-client';
import { DownloadPdfButton } from '../../../components/DownloadPdfButton';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  paid:          'bg-green-900 text-green-300',
  open:          'bg-blue-900 text-blue-300',
  void:          'bg-slate-700 text-slate-400',
  uncollectible: 'bg-red-900 text-red-300',
  draft:         'bg-yellow-900 text-yellow-300',
};

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const sessionToken = process.env.ORBITAL_DEMO_TOKEN ?? '';

  let invoice;
  try {
    invoice = await getInvoice(sessionToken, params.id);
  } catch {
    notFound();
  }

  const rows = [
    { label: 'Invoice ID',   value: invoice.id,         mono: true },
    { label: 'Tenant',       value: invoice.tenant_name },
    { label: 'Amount',       value: `${invoice.currency} ${(invoice.total_cents / 100).toFixed(2)}` },
    { label: 'Issued',       value: invoice.issued_at },
    { label: 'Due',          value: invoice.due_date },
  ];

  return (
    <div className="space-y-8 max-w-2xl" data-print="invoice">
      <div className="flex items-center justify-between" data-print="hide">
        <Link href="/invoices" className="text-slate-400 hover:text-white text-sm">
          ← Invoices
        </Link>
        <DownloadPdfButton invoiceId={invoice.id} />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Invoice</h1>
        <span className={`rounded px-3 py-1 text-sm font-medium uppercase ${STATUS_COLORS[invoice.status] ?? 'bg-slate-800 text-slate-300'}`}>
          {invoice.status}
        </span>
      </div>

      <div className="rounded-lg bg-orbital-surface divide-y divide-slate-700">
        {rows.map(({ label, value, mono }) => (
          <div key={label} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-slate-400">{label}</span>
            <span className={`text-sm ${mono ? 'font-mono text-slate-300' : 'text-white'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-orbital-surface">
        <div className="px-5 py-4 border-b border-slate-700">
          <span className="text-sm font-medium text-slate-300">Line items</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-slate-300">Subscription — {invoice.tenant_name}</span>
          <span className="text-sm text-white">
            {invoice.currency} {(invoice.total_cents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-sm font-semibold">
            {invoice.currency} {(invoice.total_cents / 100).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
