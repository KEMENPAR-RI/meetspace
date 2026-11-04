'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';

import { prisma } from '@/lib/prisma';
import { authorizeAttendance, authorizeBooking, authorizeUser, getCurrentUser } from '@/lib/auth/access';
import { getClientIpKey, isOfficeIp } from '@/lib/office-access';
import { consumePublicMutationQuota, isBookingAttendanceFull, rateLimitMessage } from '@/lib/rate-limit';
import { RECAPTCHA_FAILED_MESSAGE, verifyRecaptcha } from '@/lib/recaptcha';
import { getAppSettings } from '@/lib/settings/queries';
import { recordAttendance, type DeviceLockOption, type RecordAttendanceResult } from '@/lib/booking/attendance';
import { isAttendanceOpen } from '@/lib/booking/attendance-window';
import {
  getDeviceLockRemainingMin,
  hashDeviceId,
  newDeviceId,
  readDeviceKey,
  setDeviceCookie,
} from '@/lib/booking/device-lock';
import { findOpenBookingByStart } from '@/lib/booking/public-attendance';
import { isUuid } from '@/lib/uuid';
import {
  deviceLockedMessage,
  type AttendanceFormState,
  type DeleteAttendanceResult,
} from '@/lib/booking/types';
import {
  parseAttendanceInput,
  readAttendanceValues,
  type AttendanceValues,
} from '@/lib/booking/validation';

const CLOSED_MESSAGE = 'Daftar hadir sudah ditutup.';
const INVALID_LINK_MESSAGE = 'Link daftar hadir tidak valid.';
const NO_MEETING_MESSAGE = 'Tidak ada rapat yang sedang berlangsung di ruangan ini.';
const MEETING_CHANGED_MESSAGE = 'Rapat sudah berganti, muat ulang halaman.';
const SAVE_FAILED_MESSAGE = 'Daftar hadir gagal disimpan. Silakan coba lagi.';
const SUCCESS_MESSAGE = 'Kehadiran berhasil dicatat.';

// `bookingId` is bound on the client: treat it as unknown at runtime.
export async function signAttendance(
  bookingId: string,
  _prevState: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const values = readAttendanceValues(formData);
  const fail = (message: string): AttendanceFormState => ({ status: 'error', message, values });

  // Internal form is dashboard only; participants use /hadir.
  const user = await authorizeUser();
  if (!user) return fail('Tidak diizinkan.');

  const booking = await authorizeBooking(user, bookingId);
  if (!booking) return fail('Tidak diizinkan.');
  const now = new Date();
  if (!isAttendanceOpen(booking.startsAt, booking.endsAt, now)) return fail(CLOSED_MESSAGE);

  const parsed = parseAttendanceInput(formData);
  if (!parsed.ok) return invalidForm(parsed.fieldErrors, parsed.values);

  const result = await recordAttendance(booking, parsed.data, now);
  if (!result.ok) return recordFailure(result.reason, values, 'Booking tidak ditemukan.');

  refresh();
  return { status: 'success', message: SUCCESS_MESSAGE };
}

// Public (no office check by design): per room, never refreshes or returns meeting/attendee data.
// Bound on the client: `roomId` and `meetingStart` (ISO start of the meeting the form showed). The booking is
// resolved on the server and must still be that meeting, so back-to-back meetings never swap attendees.
// FormData `recaptchaToken` (reCAPTCHA v3, action 'attendance') when enabled.
// No valid session: per-IP limit (office allowlist IPs exempt) + one success per device per cooldown.
export async function submitPublicAttendance(
  roomId: string,
  meetingStart: string,
  _prevState: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const values = readAttendanceValues(formData);
  const fail = (message: string): AttendanceFormState => ({ status: 'error', message, values });

  const expectedStart = typeof meetingStart === 'string' ? Date.parse(meetingStart) : NaN;
  if (!isUuid(roomId) || Number.isNaN(expectedStart)) return fail(INVALID_LINK_MESSAGE);

  const h = await headers();
  const now = new Date();
  // Server-verified session (admin/superadmin) bypasses the IP and device limits, not reCAPTCHA.
  const user = await getCurrentUser();
  // Office allowlist IPs: exempt from the per-IP limit and the per-meeting cap.
  const office = await isOfficeIp(h);
  if (!user && !office) {
    const ipKey = await getClientIpKey(h);
    if (!ipKey) return fail('Tidak diizinkan.');
    // Counts every attempt, including ones that fail validation.
    const quota = await consumePublicMutationQuota(ipKey, now);
    if (!quota.ok) return fail(rateLimitMessage(quota.retryAfterMin));
  }

  if (!(await verifyRecaptcha(formData.get('recaptchaToken'), 'attendance')).ok) return fail(RECAPTCHA_FAILED_MESSAGE);

  let deviceLock: DeviceLockOption | undefined;
  let newDeviceRaw: string | null = null;
  if (!user) {
    const device = await readDeviceKey();
    try {
      const remaining = device.key ? await getDeviceLockRemainingMin(device.key, now) : null;
      if (remaining !== null) return fail(deviceLockedMessage(remaining));
      let key = device.key;
      if (!key) {
        newDeviceRaw = newDeviceId();
        key = hashDeviceId(newDeviceRaw);
      }
      deviceLock = { key, cooldownMin: (await getAppSettings()).attendanceDeviceCooldownMin };
    } catch (error) {
      // Fails closed: the device limit cannot be checked.
      console.error('[submitPublicAttendance] device lock check failed', error);
      return fail(SAVE_FAILED_MESSAGE);
    }
  }

  const { booking, changed } = await findOpenBookingByStart(roomId.toLowerCase(), expectedStart, now);
  if (!booking) return fail(changed ? MEETING_CHANGED_MESSAGE : NO_MEETING_MESSAGE);
  if (!office && (await isBookingAttendanceFull(booking.id))) return fail('Daftar hadir sudah penuh.');

  const parsed = parseAttendanceInput(formData);
  if (!parsed.ok) return invalidForm(parsed.fieldErrors, parsed.values);

  const result = await recordAttendance(booking, parsed.data, now, { precheck: false, deviceLock });
  if (!result.ok) {
    if (result.reason === 'device-locked' && deviceLock) {
      // Lost a race with a parallel submit from this device.
      const remaining = await getDeviceLockRemainingMin(deviceLock.key, now).catch(() => null);
      return fail(deviceLockedMessage(remaining ?? deviceLock.cooldownMin));
    }
    return recordFailure(result.reason, values, NO_MEETING_MESSAGE);
  }

  if (newDeviceRaw) {
    try {
      await setDeviceCookie(newDeviceRaw);
    } catch (error) {
      console.error('[submitPublicAttendance] failed to set device cookie', error);
    }
  }
  return { status: 'success', message: SUCCESS_MESSAGE };
}

function invalidForm(
  fieldErrors: AttendanceFormState['fieldErrors'],
  values: AttendanceValues,
): AttendanceFormState {
  return { status: 'error', message: 'Periksa kembali isian formulir.', fieldErrors, values };
}

function recordFailure(
  reason: Extract<RecordAttendanceResult, { ok: false }>['reason'],
  values: AttendanceValues,
  goneMessage: string,
): AttendanceFormState {
  const error = (message: string, fieldErrors?: AttendanceFormState['fieldErrors']) =>
    ({ status: 'error', message, fieldErrors, values }) satisfies AttendanceFormState;
  switch (reason) {
    case 'closed':
      return error(CLOSED_MESSAGE);
    case 'duplicate-name':
      return error('Nama ini sudah tercatat hadir.', { attendeeName: 'Nama ini sudah tercatat hadir.' });
    case 'duplicate-phone':
      return error('No HP ini sudah tercatat hadir.', { phone: 'No HP ini sudah tercatat hadir.' });
    case 'duplicate':
      return error('Nama atau No HP ini sudah tercatat hadir.');
    case 'gone':
      return error(goneMessage);
    default:
      return error(SAVE_FAILED_MESSAGE);
  }
}

// `id` comes from the client: treat it as unknown at runtime.
export async function deleteAttendance(id: string): Promise<DeleteAttendanceResult> {
  // Authorization is enforced here; hiding the button is UX only.
  const user = await authorizeUser();
  if (!user) return { ok: false, message: 'Tidak diizinkan.' };

  try {
    // Missing and out-of-scope look the same (G4).
    const found = await authorizeAttendance(user, id);
    if (!found) return { ok: false, message: 'Tidak diizinkan.' };
    await prisma.attendance.deleteMany({ where: { id: found.id } });
  } catch (error) {
    console.error('[deleteAttendance] failed to delete attendance', error);
    return { ok: false, message: 'Gagal menghapus data hadir.' };
  }

  refresh();
  return { ok: true };
}
