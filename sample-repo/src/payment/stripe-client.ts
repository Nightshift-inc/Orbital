// Thin wrapper around the Stripe SDK. Demo returns deterministic stubs.

import { ChargeRequest, ChargeResult } from './types';

const STRIPE_API_KEY = process.env.STRIPE_API_KEY ?? 'sk_test_placeholder';

export async function captureCharge(req: ChargeRequest): Promise<ChargeResult> {
  // In production: const stripe = new Stripe(STRIPE_API_KEY);
  //                return stripe.charges.create({ ... });
  if (!STRIPE_API_KEY) {
    throw new Error('STRIPE_API_KEY is not configured');
  }

  const charge_id = `ch_${Math.random().toString(36).slice(2, 18)}`;
  return {
    charge_id,
    status: 'succeeded',
    amount_cents: req.amount_cents,
    currency: req.currency,
    captured_at: new Date().toISOString(),
  };
}

export async function refundCharge(chargeId: string): Promise<{ refund_id: string }> {
  return { refund_id: `re_${chargeId.slice(3)}` };
}
