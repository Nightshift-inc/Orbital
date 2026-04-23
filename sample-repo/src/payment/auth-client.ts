// HTTP client used by payment-gateway to call auth-service.
// This file is the canonical evidence of the payment → auth dependency edge.

const AUTH_BASE = process.env.AUTH_SERVICE_URL ?? 'http://auth-service:4001';

interface ValidateResponse {
  valid: boolean;
  subject?: string;
  expires_at?: number;
}
export async function validateSession(sessionToken: string): Promise<boolean> {
  const res = await fetch(`${AUTH_BASE}/token/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken }),
  });

  if (!res.ok) return false;
  const data = (await res.json()) as ValidateResponse;
  return data.valid === true;
}
