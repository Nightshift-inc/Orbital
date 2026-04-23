import { listInvoices } from '../../lib/api-client';
import { InvoiceTable } from '../../components/InvoiceTable';
import { CreateInvoiceButton } from '../../components/CreateInvoiceButton';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const sessionToken = process.env.ORBITAL_DEMO_TOKEN ?? '';

  let invoices;
  try {
    invoices = await listInvoices(sessionToken);
  } catch {
    invoices = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Invoices</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
          </span>
          <CreateInvoiceButton />
        </div>
      </div>
      {invoices.length === 0 ? (
        <p className="text-slate-400">No invoices yet.</p>
      ) : (
        <InvoiceTable invoices={invoices} />
      )}
    </div>
  );
}
