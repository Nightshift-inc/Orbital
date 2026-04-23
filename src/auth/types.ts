// Shared types for auth-service.

export interface Session {
  id: string;
  subject: string;
  tenant_id: string;
  issued_at: number;
  expires_at: number;
  scopes: string[];
}

export interface TokenPayload {
  sub: string;
  tid: string;  // tenant id
  iat: number;
  exp: number;
  scp: string[];
}

export interface SessionCookie {
  session_token: string;
  csrf_token: string;
}

export type AuthFailureReason =
  | 'missing_token'
  | 'malformed_token'
  | 'expired_token'
  | 'revoked_session'
  | 'tenant_suspended';

export interface AuthOutcome {
  valid: boolean;
  subject?: string;
  tenant_id?: string;
  reason?: AuthFailureReason;
}
