// Shared types for payment-gateway.

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

export interface ChargeRequest {
  session_token: string;
  amount_cents: number;
  currency: Currency;
  idempotency_key?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  charge_id: string;
  status: 'succeeded' | 'failed' | 'pending';
  amount_cents: number;
  currency: Currency;
  captured_at?: string;
  failure_reason?: string;
}

export interface Invoice {
  invoice_id: string;
  tenant_id: string;
  line_items: InvoiceLineItem[];
  total_cents: number;
  currency: Currency;
  due_date: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_amount_cents: number;
  period_start?: string;
  period_end?: string;
}
