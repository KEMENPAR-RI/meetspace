import { io } from 'next/cache';
import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';

import { deleteSessionByToken, insertSession, pruneExpiredSessions, SESSION_TTL_MS } from './session-store';

// Cookie side of DB sessions. Server-only by convention: never import from a client component.

export const SESSION_COOKIE = 'br_session';
// v1 single-password cookie; only deleted, never read (E2).
const LEGACY_COOKIE = 'br_admin';

// Raw cookie token, or null; also defers the clock (io()) for Cache Components.
export async function readSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    // cookies() resolves in the App Shell stage (partialPrefetching), the clock does not; io() defers it.
    await io();
    return cookieStore.get(SESSION_COOKIE)?.value ?? null;
  } catch (error) {
    unstable_rethrow(error);
    console.error('[auth] readSessionToken failed', error);
    return null;
  }
}

// Server Actions only: new DB session + cookie (absolute 2h expiry).
export async function createSession(userId: string): Promise<void> {
  const now = new Date();
  await pruneExpiredSessions(now);
  const { token } = await insertSession(userId, now.getTime());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  cookieStore.delete(LEGACY_COOKIE);
}

// Server Actions only: deletes this browser's session row and cookie.
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await deleteSessionByToken(token);
    } catch (error) {
      console.error('[auth] failed to delete session row', error);
    }
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(LEGACY_COOKIE);
}
