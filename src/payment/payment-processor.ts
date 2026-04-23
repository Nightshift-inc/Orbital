interface ProcessArgs {
  amount_cents: number;
  currency: string;
}

interface ProcessResult {
  charge_id: string;
  status: 'succeeded' | 'failed';
  amount_cents: number;
  currency: string;
}

// Stub payment processor — for the demo this returns deterministic results
// without hitting any real payment provider.
export async function processPayment(args: ProcessArgs): Promise<ProcessResult> {
  const charge_id = `ch_${Math.random().toString(36).slice(2, 12)}`;
  return {
    charge_id,
    status: 'succeeded',
    amount_cents: args.amount_cents,
    currency: args.currency,
  };
}
