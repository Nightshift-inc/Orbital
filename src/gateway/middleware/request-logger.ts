import { Request, Response, NextFunction } from 'express';
import { RequestContext } from '../types';
import { randomUUID } from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const ctx: RequestContext = {
    request_id: (req.headers['x-request-id'] as string) ?? randomUUID(),
    started_at: Date.now(),
    route: req.path,
    method: req.method,
  };

  (req as Request & { ctx: RequestContext }).ctx = ctx;
  res.setHeader('X-Request-Id', ctx.request_id);

  res.on('finish', () => {
    const elapsed_ms = Date.now() - ctx.started_at;
    console.log(JSON.stringify({
      level: 'info',
      request_id: ctx.request_id,
      method: ctx.method,
      route: ctx.route,
      status: res.statusCode,
      elapsed_ms,
    }));
  });

  next();
}
