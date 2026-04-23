import { Invoice, InvoiceLineItem, Currency } from './types';

export function generateInvoice(args: {
  tenant_id: string;
  line_items: InvoiceLineItem[];
  currency: Currency;
  due_in_days: number;
}): Invoice {
  const total_cents = args.line_items.reduce(
    (acc, item) => acc + item.unit_amount_cents * item.quantity,
    0,
  );

  const due_date = new Date();
  due_date.setDate(due_date.getDate() + args.due_in_days);

  return {
    invoice_id: `inv_${Math.random().toString(36).slice(2, 14)}`,
    tenant_id: args.tenant_id,
    line_items: args.line_items,
    total_cents,
    currency: args.currency,
    due_date: due_date.toISOString().slice(0, 10),
    status: 'open',
  };
}
