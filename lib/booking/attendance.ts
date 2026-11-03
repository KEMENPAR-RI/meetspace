import { prisma } from '@/lib/prisma';

import { isAttendanceOpen } from './attendance-window';
import { claimDeviceLock, pruneDeviceLocks } from './device-lock';
import type { AttendanceInput } from './validation';

export type RecordAttendanceResult =
  | { ok: true }
  | { ok: false; reason: 'closed' | 'duplicate-name' | 'duplicate-phone' | 'duplicate' | 'gone' | 'device-locked' | 'error' };

export type DeviceLockOption = { key: string; cooldownMin: number };

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const PRISMA_FK_VIOLATION = 'P2003';
// Roughly 1 in N successful device claims prunes expired lock rows.
const DEVICE_PRUNE_EVERY = 20;

// Thrown inside the transaction so the claim upsert rolls back too.
class DeviceLockedError extends Error {}

// Shared by the internal and public paths; the caller has already authorized the request.
// precheck=false (public): duplicates only surface as generic 'duplicate' to avoid leaking who attended.
// deviceLock (public): claim + insert in one transaction; any failure leaves the device unlocked.
export async function recordAttendance(
  booking: { id: string; startsAt: Date; endsAt: Date },
  input: AttendanceInput,
  now: Date,
  { precheck = true, deviceLock }: { precheck?: boolean; deviceLock?: DeviceLockOption } = {},
): Promise<RecordAttendanceResult> {
  if (!isAttendanceOpen(booking.startsAt, booking.endsAt, now)) return { ok: false, reason: 'closed' };

  const { name, nameKey, satker, gender, role, phone } = input;
  try {
    // Pre-checks give per-field messages; the unique indexes still decide races.
    const sameName =
      precheck &&
      (await prisma.attendance.findFirst({
        where: { bookingId: booking.id, nameKey },
        select: { id: true },
      }));
    if (sameName) return { ok: false, reason: 'duplicate-name' };
    if (precheck && phone) {
      const samePhone = await prisma.attendance.findFirst({
        where: { bookingId: booking.id, phone },
        select: { id: true },
      });
      if (samePhone) return { ok: false, reason: 'duplicate-phone' };
    }

    // Explicit allowlist; signature = name (typed signature input was removed).
    const data = { bookingId: booking.id, name, nameKey, satker, gender, role, phone, signature: name };
    if (!deviceLock) {
      await prisma.attendance.create({ data, select: { id: true } });
      return { ok: true };
    }

    await prisma.$transaction(async (tx) => {
      if (!(await claimDeviceLock(tx, deviceLock.key, now, deviceLock.cooldownMin))) throw new DeviceLockedError();
      await tx.attendance.create({ data, select: { id: true } });
    });
    if (Math.random() * DEVICE_PRUNE_EVERY < 1) await pruneDeviceLocks(now, deviceLock.cooldownMin);
    return { ok: true };
  } catch (error) {
    if (error instanceof DeviceLockedError) return { ok: false, reason: 'device-locked' };
    const code = prismaCode(error);
    if (code === PRISMA_UNIQUE_VIOLATION) return { ok: false, reason: 'duplicate' };
    if (code === PRISMA_FK_VIOLATION) return { ok: false, reason: 'gone' };
    console.error('[recordAttendance] failed to save attendance', error);
    return { ok: false, reason: 'error' };
  }
}

// PrismaClientKnownRequestError code (e.g. P2002), if any.
function prismaCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
