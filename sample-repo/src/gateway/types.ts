// Shared types for api-gateway.

export interface RequestContext {
  request_id: string;
  tenant_id?: string;
  subject?: string;
  started_at: number;
  route: string;
  method: string;
}

export interface RateLimitConfig {
  tier: 'free' | 'starter' | 'growth' | 'scale';
  requests_per_minute: number;
  burst: number;
}

export interface GatewayError {
  error: string;
  type: string;
  request_id?: string;
  retry_after_seconds?: number;
}
