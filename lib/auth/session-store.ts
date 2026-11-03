import { createHash, randomBytes } from 'node:crypto';

import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';

// DB-backed sessions (sessions table). Only the SHA-256 of the token is stored.

// Absolute lifetime, no sliding.
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// 32 random bytes, base64url without padding.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isSessionToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

// Returns the raw token for the cookie.
export async function insertSession(userId: string, nowMs: number): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(nowMs + SESSION_TTL_MS);
  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
    select: { id: true },
  });
  return { token, expiresAt };
}

// Opportunistic cleanup (no cron); never fails the caller.
export async function pruneExpiredSessions(now: Date): Promise<void> {
  try {
    await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  } catch (error) {
    console.error('[session] cleanup failed', error);
  }
}

export async function deleteSessionByToken(token: string): Promise<void> {
  if (!isSessionToken(token)) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

// Revokes every session of a user (password change/reset, deactivation, role change).
export async function deleteUserSessions(userId: string, db: Prisma.TransactionClient = prisma): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN';
  roomIds: string[];
};

// Valid = row exists, not expired, user active.
export async function findSessionUser(token: string, now: Date): Promise<SessionUser | null> {
  if (!isSessionToken(token)) return null;
  const row = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          isActive: true,
          rooms: { select: { roomId: true } },
        },
      },
    },
  });
  if (!row || row.expiresAt <= now || !row.user.isActive) return null;
  const { user } = row;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    // Superadmin is never a room PJ; its scope is "all" anyway.
    roomIds: user.role === 'ADMIN' ? user.rooms.map((r) => r.roomId) : [],
  };
}
