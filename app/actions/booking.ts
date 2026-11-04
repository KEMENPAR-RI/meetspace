'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';

import { authorizeBooking, authorizeUser, canAccessRoom, getCurrentUser } from '@/lib/auth/access';
import { resolveLoginIpKey } from '@/lib/auth/login-rate-limit';
import { findOverlap, lockRoomForWrite, type OverlappingSlot } from '@/lib/booking/queries';
import { formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import type { BookingFormState, CancelBookingResult } from '@/lib/booking/types';
import { parseBookingInput, readBookingValues, type BookingValues } from '@/lib/booking/validation';
import { getClientIpKey } from '@/lib/office-access';
import { prisma } from '@/lib/prisma';
import { consumePublicMutationQuota, rateLimitMessage } from '@/lib/rate-limit';
import { RECAPTCHA_FAILED_MESSAGE, RECAPTCHA_NOT_CONFIGURED_MESSAGE, verifyRecaptcha } from '@/lib/recaptcha';
import { ROOM_TX_OPTIONS } from '@/lib/room/lock';
import { isUuid } from '@/lib/uuid';

const ROOM_UNAVAILABLE = 'Ruangan tidak tersedia.';
const UNKNOWN_IP_MESSAGE = 'Tidak dapat memverifikasi alamat jaringan. Hubungi admin.';

type TxOutcome = { kind: 'ok' } | { kind: 'clash'; slot: OverlappingSlot } | { kind: 'room' } | { kind: 'gone' };

// Public (internet). `roomId` is bound on the server page; treat it as unknown at runtime.
// Requires FormData `recaptchaToken` (reCAPTCHA v3, action 'booking'); rejected while reCAPTCHA is off.
// Per-IP limit unless the request has a valid session.
export async function createBooking(
  roomId: string,
  _prevState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const values = readBookingValues(formData);
  const h = await headers();
  if (!isUuid(roomId)) return { status: 'error', message: ROOM_UNAVAILABLE, values };

  if (!(await getCurrentUser())) {
    // Same rule as login/proxy: no client IP -> refused in production, "dev-local" key in `next dev`.
    const ipKey = resolveLoginIpKey(await getClientIpKey(h));
    if (!ipKey) {
      console.error('[createBooking] client IP header missing or invalid (check trusted IP header setting)');
      return { status: 'error', message: UNKNOWN_IP_MESSAGE, values };
    }
    const quota = await consumePublicMutationQuota(ipKey, new Date());
    if (!quota.ok) return { status: 'error', message: rateLimitMessage(quota.retryAfterMin), values };
  }
  const captcha = await verifyRecaptcha(formData.get('recaptchaToken'), 'booking', { required: true });
  if (!captcha.ok) {
    const message = captcha.reason === 'not-configured' ? RECAPTCHA_NOT_CONFIGURED_MESSAGE : RECAPTCHA_FAILED_MESSAGE;
    return { status: 'error', message, values };
  }

  const parsed = parseBookingInput(formData);
  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'Periksa kembali isian formulir.',
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const { startsAt, endsAt, bookerName, satker, agenda } = parsed.data;

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<TxOutcome> => {
      // Room lock serializes writes per room and checks active atomically (A3, C4/C5).
      const room = (await lockRoomForWrite(tx, [roomId])).get(roomId);
      if (!room || !room.isActive) return { kind: 'room' };
      const slot = await findOverlap(room.id, startsAt, endsAt, undefined, tx);
      if (slot) return { kind: 'clash', slot };

      // Explicit allowlist; never spread form data.
      await tx.booking.create({
        data: {
          roomId: room.id,
          startsAt,
          endsAt,
          bookerName,
          satker,
          agenda,
        },
        select: { id: true },
      });
      return { kind: 'ok' };
    }, ROOM_TX_OPTIONS);
    if (outcome.kind === 'room') return { status: 'error', message: ROOM_UNAVAILABLE, values };
    if (outcome.kind === 'clash') return overlapError(outcome.slot, values);
  } catch (error) {
    console.error('[createBooking] failed to save booking', error);
    return { status: 'error', message: 'Booking gagal disimpan. Silakan coba lagi.', values };
  }

  refresh();
  return { status: 'success', message: 'Booking berhasil disimpan.' };
}

// Dashboard. `id` is bound on the client; optional form field `roomId` moves the booking (H3).
export async function updateBooking(
  id: string,
  _prevState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const values = readBookingValues(formData);
  const fail = (message: string, fieldErrors?: BookingFormState['fieldErrors']): BookingFormState => ({
    status: 'error',
    message,
    fieldErrors,
    values,
  });

  const user = await authorizeUser();
  if (!user) return fail('Tidak diizinkan.');

  let existing;
  try {
    existing = await authorizeBooking(user, id);
  } catch (error) {
    console.error('[updateBooking] failed to load booking', error);
    return fail('Booking gagal diperbarui. Silakan coba lagi.');
  }
  // Missing and out-of-scope look the same (G4).
  if (!existing) return fail('Tidak diizinkan.');

  const now = new Date();
  if (getBookingStatus(existing.startsAt, existing.endsAt, now) === 'done') {
    return fail('Booking yang sudah selesai tidak bisa diubah.');
  }

  const requestedRoom = (values.roomId ?? '').trim().toLowerCase();
  const targetRoomId = requestedRoom === '' ? existing.roomId : requestedRoom;
  const moving = targetRoomId !== existing.roomId;
  if (moving && (!isUuid(targetRoomId) || !canAccessRoom(user, targetRoomId))) {
    return fail('Periksa kembali isian formulir.', { roomId: 'Ruangan tidak valid.' });
  }

  const parsed = parseBookingInput(formData, now, { originalStartsAt: existing.startsAt });
  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'Periksa kembali isian formulir.',
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const { startsAt, endsAt, bookerName, satker, agenda } = parsed.data;
  const sourceRoomId = existing.roomId;

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<TxOutcome> => {
      // Source + target locked in id order (deadlock-safe).
      const rooms = await lockRoomForWrite(tx, [sourceRoomId, targetRoomId]);
      const target = rooms.get(targetRoomId);
      // Moving needs an active target; staying in an inactive room is still manageable (A3).
      if (!target || (moving && !target.isActive)) return { kind: 'room' };
      const slot = await findOverlap(targetRoomId, startsAt, endsAt, id, tx);
      if (slot) return { kind: 'clash', slot };

      // Explicit allowlist; roomId guard catches a concurrent move.
      const { count } = await tx.booking.updateMany({
        where: { id, roomId: sourceRoomId },
        data: { roomId: targetRoomId, startsAt, endsAt, bookerName, satker, agenda },
      });
      return count === 1 ? { kind: 'ok' } : { kind: 'gone' };
    }, ROOM_TX_OPTIONS);
    if (outcome.kind === 'room') return fail(ROOM_UNAVAILABLE, { roomId: ROOM_UNAVAILABLE });
    if (outcome.kind === 'clash') return overlapError(outcome.slot, values);
    if (outcome.kind === 'gone') return fail('Booking tidak ditemukan.');
  } catch (error) {
    console.error('[updateBooking] failed to update booking', error);
    return fail('Booking gagal diperbarui. Silakan coba lagi.');
  }

  refresh();
  return { status: 'success', message: 'Booking berhasil diperbarui.' };
}

// Dashboard. `id` comes from the client: treat it as unknown at runtime.
export async function cancelBooking(id: string): Promise<CancelBookingResult> {
  const user = await authorizeUser();
  if (!user) return { ok: false, message: 'Tidak diizinkan.' };

  try {
    const existing = await authorizeBooking(user, id);
    if (!existing) return { ok: false, message: 'Tidak diizinkan.' };
    // Finished bookings are kept for the reservation log; same rule as updateBooking.
    if (getBookingStatus(existing.startsAt, existing.endsAt, new Date()) === 'done') {
      return { ok: false, message: 'Booking yang sudah selesai tidak bisa dibatalkan.' };
    }
    // roomId guard: a concurrent move out of scope is not deleted.
    await prisma.booking.deleteMany({ where: { id: existing.id, roomId: existing.roomId } });
  } catch (error) {
    console.error('[cancelBooking] failed to delete booking', error);
    return { ok: false, message: 'Gagal membatalkan booking.' };
  }

  refresh();
  return { ok: true };
}

function overlapError(clash: OverlappingSlot, values: BookingValues): BookingFormState {
  return {
    status: 'error',
    message: 'Jadwal bentrok dengan booking lain.',
    fieldErrors: {
      startTime: `Ruangan sudah dibooking pada jam tersebut (${formatTimeRange(clash.startsAt, clash.endsAt)}).`,
    },
    values,
  };
}
