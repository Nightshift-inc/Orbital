import { Request, Response, NextFunction } from 'express';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    session_token: string;
  };
}

// PR #847: Migrate from header-based to cookie-based session tokens.
//
// BUG: Previously the middleware pulled the token from req.headers.authorization
// and handled a missing header gracefully. The cookie-based refactor below
// assumes req.cookies.session is always an object. On requests where the
// cookie is absent (public routes, curl probes, health checks from paths we
// forgot to whitelist), req.cookies.session is undefined and dereferencing
// .session_token on line 43 throws a TypeError that crashes the handler.

const PUBLIC_PATHS = new Set(['/health', '/metrics', '/token/validate']);

export function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (PUBLIC_PATHS.has(req.path)) {
    return next();
  }

  // Header-based lookup (removed in PR #847):
  //   const authHeader = req.headers.authorization;
  //   if (!authHeader?.startsWith('Bearer ')) {
  //     res.status(401).json({ error: 'Missing bearer token' });
  //     return;
  //   }
  //   const token = authHeader.split(' ')[1];

  // Cookie-based lookup (added in PR #847):
  // The session cookie is set by the login endpoint after password check.
  // On requests that pre-date the cookie-parser mount order, or on health
  // probes routed outside the normal flow, this will be undefined.
  const token = req.cookies?.session?.session_token;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.user = {
    id: decodeTokenSubject(token),
    session_token: token,
  };
  next();
}

function decodeTokenSubject(token: string): string {
  const parts = token.split('.');
  if (parts.length < 2) return 'anonymous';
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return payload.sub ?? 'anonymous';
}
