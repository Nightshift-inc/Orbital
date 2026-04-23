import { Request, Response, NextFunction } from 'express';
import { RateLimitConfig } from '../types';

const TIER_LIMITS: Record<string, RateLimitConfig> = {
  free:    { tier: 'free',    requests_per_minute: 60,    burst: 10 },
  starter: { tier: 'starter', requests_per_minute: 600,   burst: 100 },
  growth:  { tier: 'growth',  requests_per_minute: 6000,  burst: 500 },
  scale:   { tier: 'scale',   requests_per_minute: 30000, burst: 2000 },
};

const counters = new Map<string, { count: number; reset_at: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const tenantId = (req.headers['x-orbital-tenant'] as string) ?? 'anonymous';
  const tier = (req.headers['x-orbital-tier'] as string) ?? 'free';
  const config = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  const now = Date.now();
  const key = `${tenantId}:${Math.floor(now / 60_000)}`;
  const bucket = counters.get(key) ?? { count: 0, reset_at: now + 60_000 };
  bucket.count += 1;
  counters.set(key, bucket);

  res.setHeader('X-RateLimit-Limit', config.requests_per_minute);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.requests_per_minute - bucket.count));
  res.setHeader('X-RateLimit-Reset', Math.floor(bucket.reset_at / 1000));

  if (bucket.count > config.requests_per_minute) {
    res.status(429).json({ error: 'Rate limit exceeded', retry_after_seconds: 60 });
    return;
  }
  next();
}
