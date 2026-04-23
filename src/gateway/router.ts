import { Router, Request, Response, NextFunction } from 'express';

const AUTH_BASE = process.env.AUTH_SERVICE_URL ?? 'http://auth-service:4001';
const PAYMENT_BASE = process.env.PAYMENT_SERVICE_URL ?? 'http://payment-gateway:4002';

interface AuthClient {
  verify(authorization: string): Promise<{ valid: boolean; subject?: string }>;
}

interface PaymentClient {
  charge(amount: number, currency: string, sessionToken: string): Promise<{ id: string }>;
}

const authClient: AuthClient = {
  async verify(authorization: string) {
    const res = await fetch(`${AUTH_BASE}/token/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authorization?.replace(/^Bearer /, '') }),
    });
    return res.json() as Promise<{ valid: boolean; subject?: string }>;
  },
};

export const router = Router();

// ---- Auth-protected login route ----
// Line 34 below is the canonical evidence for the gateway -> auth dependency
// edge. Mode 2's dependency extractor picks up the fetch call inside verify()
// via this invocation.
//
router.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authResult = await authClient.verify(req.headers.authorization ?? ''); // line 34
    if (!authResult.valid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ user: authResult.subject });
  } catch (err) {
    next(err);
  }
});

// ---- Payment capture route ----
const paymentClient: PaymentClient = {
  async charge(amount, currency, sessionToken) {
    const res = await fetch(`${PAYMENT_BASE}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: sessionToken,
        amount_cents: amount,
        currency,
      }),
    });
    return res.json() as Promise<{ id: string }>;
  },
};

router.post('/api/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.session?.session_token ?? '';
    const authResult = await authClient.verify(`Bearer ${sessionToken}`);
    if (!authResult.valid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const charge = await paymentClient.charge(
      req.body.amount,
      req.body.currency ?? 'USD',
      sessionToken,
    );
    res.json({ charge_id: charge.id });
  } catch (err) {
    next(err);
  }
});

// ---- Error forwarding handler ----
// This handler appears in stack traces when a downstream service throws
// during request handling. Line 89 is the error re-raise that surfaces
// middleware-originated errors to the Express error pipeline.
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as unknown as { status?: number }).status ?? 500;
  res.status(status).json({
    error: err.message,                    // line 89
    type: err.constructor.name,
  });
});
