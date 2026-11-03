import { createHash, randomBytes } from 'node:crypto';

import { io } from 'next/cache';
import { cookies } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';

import { shouldUseSecureCookie } from '@/lib/auth/cookie-secure';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/settings/queries';

// Per-device cooldown for public attendance (ADR 0004). Server-only: never import from a client component.

export const DEVICE_COOKIE = 'br_device';
// Browser cap for cookie lifetime.
const DEVICE_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;
// 32 random bytes as base64url, unpadded.
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{43}$/;
const MINUTE_MS = 60_000;
// Seeds a fresh row so the claim UPDATE below always finds it unlocked.
const UNLOCKED_SENTINEL = new Date(0);
const PRUNE_BATCH = 100;

export function newDeviceId(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDeviceId(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

// Raw cookie + its sha256 key; both null when missing or malformed. Read-only (safe in pages).
export async function readDeviceKey(): Promise<{ raw: string | null; key: string | null }> {
  try {
    const cookieStore = await cookies();
    await io();
    const raw = cookieStore.get(DEVICE_COOKIE)?.value;
    if (!raw || !DEVICE_ID_RE.test(raw)) return { raw: null, key: null };
    return { raw, key: hashDeviceId(raw) };
  } catch (error) {
    unstable_rethrow(error);
    console.error('[device-lock] readDeviceKey failed', error);
    return { raw: null, key: null };
  }
}

// Server Actions only.
export async function setDeviceCookie(raw: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEVICE_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await shouldUseSecureCookie(),
    path: '/',
    maxAge: DEVICE_COOKIE_MAX_AGE_S,
  });
}

// Whole minutes left (rounded up) under the current cooldown setting; null = free. Throws on DB errors.
export async function getDeviceLockRemainingMin(key: string, now: Date): Promise<number | null> {
  const [row, settings] = await Promise.all([
    prisma.attendanceDeviceLock.findUnique({ where: { deviceKey: key }, select: { lastSubmitAt: true } }),
    getAppSettings(),
  ]);
  if (!row) return null;
  const leftMs = row.lastSubmitAt.getTime() + settings.attendanceDeviceCooldownMin * MINUTE_MS - now.getTime();
  return leftMs > 0 ? Math.ceil(leftMs / MINUTE_MS) : null;
}

// Must run inside the same interactive transaction as the attendance insert, so a rollback leaves the device unlocked.
// true = claimed (last_submit_at = now); false = still in cooldown, caller should return 'device-locked'.
export async function claimDeviceLock(
  tx: Prisma.TransactionClient,
  key: string,
  now: Date,
  cooldownMin: number,
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - cooldownMin * MINUTE_MS);
  // Creates the row or no-ops on it; either way holds its X lock until the tx ends, serializing parallel submits.
  await tx.$executeRaw`INSERT INTO attendance_device_locks (device_key, last_submit_at)
    VALUES (${key}, ${UNLOCKED_SENTINEL})
    ON DUPLICATE KEY UPDATE last_submit_at = last_submit_at`;
  // Locking write reads the latest committed value under any isolation level; 0 rows = locked.
  const claimed = await tx.$executeRaw`UPDATE attendance_device_locks
    SET last_submit_at = ${now}
    WHERE device_key = ${key} AND last_submit_at <= ${cutoff}`;
  return claimed > 0;
}

// Best-effort cleanup of expired rows (call after commit, ~1 in 20 successes); never throws.
export async function pruneDeviceLocks(now: Date, cooldownMin: number): Promise<void> {
  const cutoff = new Date(now.getTime() - cooldownMin * MINUTE_MS);
  try {
    await prisma.$executeRaw`DELETE FROM attendance_device_locks WHERE last_submit_at < ${cutoff} LIMIT ${PRUNE_BATCH}`;
  } catch (error) {
    console.error('[device-lock] cleanup failed', error);
  }
}
