import express from 'express';
import { processPayment } from './payment-processor';
import { validateSession } from './auth-client';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'payment-gateway' });
});

app.post('/charge', async (req, res) => {
  const { session_token, amount_cents, currency } = req.body;

  const ok = await validateSession(session_token);
  if (!ok) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const result = await processPayment({ amount_cents, currency });
  res.json(result);
});

const PORT = Number(process.env.PAYMENT_SERVICE_PORT ?? 4002);
app.listen(PORT, () => {
  console.log(`[payment-gateway] listening on :${PORT}`);
});
