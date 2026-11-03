'use server';

import { refresh } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { authorizeBooking, authorizeSuperadmin, authorizeUser } from '@/lib/auth/access';
import { getBookingStatus } from '@/lib/booking/time';
import { RESET_CONFIRMATION, type BookingFormState } from '@/lib/booking/types';
import { parseBookingText, readBookingTextValues } from '@/lib/booking/validation';

export type LogActionResult = { ok: boolean; message?: string; count?: number };

// `id` comes from the client: treat it as unknown at runtime.
export async function deletePastBooking(id: string): Promise<LogActionResult> {
  // Authorization is enforced here; hiding the button is UX only.
  const user = await authorizeUser();
  if (!user) return { ok: false, message: 'Tidak diizinkan.' };

  try {
    // Missing and out-of-scope look the same (G4).
    const existing = await authorizeBooking(user, id);
    if (!existing) return { ok: false, message: 'Tidak diizinkan.' };
    const now = new Date();
    if (getBookingStatus(existing.startsAt, existing.endsAt, now) !== 'done') {
      return { ok: false, message: 'Hanya booking yang sudah selesai yang bisa dihapus dari log.' };
    }
    // Re-check endsAt in the delete itself so a concurrent edit can't slip an active booking through.
    const { count } = await prisma.booking.deleteMany({
      where: { id: existing.id, roomId: existing.roomId, endsAt: { lte: now } },
    });
    if (count === 0) {
      refresh();
      return { ok: false, message: 'Hanya booking yang sudah selesai yang bisa dihapus dari log.' };
    }
  } catch (error) {
    console.error('[deletePastBooking] failed to delete booking', error);
    return { ok: false, message: 'Gagal menghapus booking dari log.' };
  }

  refresh();
  return { ok: true };
}

// Text-only edit for finished bookings; same shape as updateBooking. `id` is bound on the client.
export async function updatePastBookingText(
  id: string,
  _prevState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const values = readBookingTextValues(formData);
  const fail = (message: string): BookingFormState => ({ status: 'error', message, values });

  const user = await authorizeUser();
  if (!user) return fail('Tidak diizinkan.');

  let existing;
  try {
    existing = await authorizeBooking(user, id);
  } catch (error) {
    console.error('[updatePastBookingText] failed to load booking', error);
    return fail('Booking gagal diperbarui. Silakan coba lagi.');
  }
  if (!existing) return fail('Tidak diizinkan.');

  const now = new Date();
  if (getBookingStatus(existing.startsAt, existing.endsAt, now) !== 'done') {
    return fail('Gunakan edit biasa untuk booking yang belum selesai.');
  }

  const parsed = parseBookingText(formData);
  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'Periksa kembali isian formulir.',
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const { bookerName, satker, agenda } = parsed.data;

  let count: number;
  try {
    // Explicit allowlist (never date/time); endsAt guard blocks a concurrent move into the future.
    ({ count } = await prisma.booking.updateMany({
      where: { id: existing.id, roomId: existing.roomId, endsAt: { lte: now } },
      data: { bookerName, satker, agenda },
    }));
  } catch (error) {
    console.error('[updatePastBookingText] failed to update booking', error);
    return fail('Booking gagal diperbarui. Silakan coba lagi.');
  }

  refresh();
  // Deleted or no longer finished since the lookup.
  if (count === 0) return fail('Booking gagal diperbarui. Silakan coba lagi.');
  return { status: 'success', message: 'Booking berhasil diperbarui.' };
}

// Deletes every booking in every room, upcoming included (intended). Superadmin only (H4).
export async function resetAllBookings(confirmation: string): Promise<LogActionResult> {
  if (!(await authorizeSuperadmin())) return { ok: false, message: 'Tidak diizinkan.' };
  if (confirmation !== RESET_CONFIRMATION) return { ok: false, message: 'Konfirmasi tidak sesuai.' };

  let count: number;
  try {
    ({ count } = await prisma.booking.deleteMany({}));
  } catch (error) {
    console.error('[resetAllBookings] failed to delete bookings', error);
    return { ok: false, message: 'Gagal mereset data booking.' };
  }

  refresh();
  return { ok: true, count };
}
