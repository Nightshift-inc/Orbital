import { Session } from './types';

// Redis-backed session store. Demo uses an in-memory Map.
const sessions = new Map<string, Session>();

export async function getSession(token: string): Promise<Session | null> {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires_at < Math.floor(Date.now() / 1000)) {
    sessions.delete(token);
    return null;
  }
  return s;
}

export async function putSession(session: Session): Promise<void> {
  sessions.set(session.id, session);
}

export async function revokeSession(token: string): Promise<void> {
  sessions.delete(token);
}

export async function revokeAllForSubject(subject: string): Promise<number> {
  let count = 0;
  for (const [id, s] of sessions.entries()) {
    if (s.subject === subject) {
      sessions.delete(id);
      count++;
    }
  }
  return count;
}
