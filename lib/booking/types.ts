// Shared contract between form, action, validation, and list.

// Also used as the form input `name` attributes.
export const BOOKING_FIELDS = [
  'date',
  'startTime',
  'endTime',
  'bookerName',
  'satker',
  'agenda',
  // Dashboard edit only (move to another room, H3); ignored on create.
  'roomId',
] as const;

export type BookingField = (typeof BOOKING_FIELDS)[number];

// Exact, case-sensitive phrase required by resetAllBookings; here so the client can import it (no zod).
export const RESET_CONFIRMATION = 'RESET';

// Shared by server validation and input `maxLength`.
export const BOOKING_LIMITS = {
  bookerName: 100,
  satker: 100,
  agenda: 1000,
} as const;

export type BookingFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<BookingField, string>>;
  // Submitted values for refilling inputs after an error.
  values?: Partial<Record<BookingField, string>>;
};

export const initialBookingFormState: BookingFormState = { status: 'idle' };

// Eager-loaded with every booking row (no N+1).
export type BookingRoom = { id: string; name: string };

export type UpcomingBooking = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  bookerName: string;
  satker: string;
  agenda: string;
  roomId: string;
  room: BookingRoom;
};

export type CancelBookingResult = { ok: true } | { ok: false; message: string };

// Serializable props for the client edit modal: ISO strings plus text, nothing else.
export type EditableBooking = {
  id: string;
  startsAt: string; // ISO 8601
  endsAt: string; // ISO 8601
  bookerName: string;
  satker: string;
  agenda: string;
  roomId: string;
};

// Also used as the attendance form input `name` attributes.
export const ATTENDANCE_FIELDS = ['attendeeName', 'gender', 'satker', 'role', 'phone'] as const;

export type AttendanceField = (typeof ATTENDANCE_FIELDS)[number];

// Shared by server validation and input `maxLength`.
export const ATTENDANCE_LIMITS = {
  attendeeName: 100,
  attendeeNameMin: 2,
  satker: 100,
  phoneRaw: 20,
} as const;

// Stable codes stored in attendances.attendee_role.
export const ATTENDEE_ROLES = [
  'pimpinan',
  'wakil_pimpinan',
  'tamu',
  'pegawai',
  'peserta_magang',
  'lainnya',
] as const;

export type AttendeeRole = (typeof ATTENDEE_ROLES)[number];

export const ATTENDEE_ROLE_LABELS: Record<AttendeeRole, string> = {
  pimpinan: 'Pimpinan',
  wakil_pimpinan: 'Wakil Pimpinan',
  tamu: 'Tamu',
  pegawai: 'Pegawai',
  peserta_magang: 'Peserta Magang',
  lainnya: 'Lainnya',
};

export function isAttendeeRole(value: unknown): value is AttendeeRole {
  return typeof value === 'string' && (ATTENDEE_ROLES as readonly string[]).includes(value);
}

// Stored in attendances.gender; legacy rows are null.
export const GENDERS = ['L', 'P'] as const;

export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = { L: 'Laki-laki', P: 'Perempuan' };

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}

// Short code for exports (L/P); legacy null shows "-".
export function genderCode(gender: string | null | undefined): string {
  return isGender(gender) ? gender : '-';
}

// Full label for display; legacy null shows "-".
export function genderLabel(gender: string | null | undefined): string {
  return isGender(gender) ? GENDER_LABELS[gender] : '-';
}

// Label for display/export; legacy rows without a role show "-".
export function attendeeRoleLabel(role: string | null | undefined): string {
  return isAttendeeRole(role) ? ATTENDEE_ROLE_LABELS[role] : '-';
}

export type AttendanceFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<AttendanceField, string>>;
  values?: Partial<Record<AttendanceField, string>>;
};

export const initialAttendanceFormState: AttendanceFormState = { status: 'idle' };

// Public attendance: this browser already submitted within the cooldown (lib/booking/device-lock.ts).
export function deviceLockedMessage(remainingMin: number): string {
  return `Perangkat ini sudah mengisi daftar hadir. Coba lagi dalam ${formatWait(remainingMin)}.`;
}

// Minutes as "45 menit" / "2 jam" / "1 jam 30 menit" (rounded up, min 1).
export function formatWait(minutes: number): string {
  const m = Math.max(1, Math.ceil(minutes));
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} jam ${rest} menit` : `${h} jam`;
}

// Serializable attendee row for the list.
export type Attendee = {
  id: string;
  name: string;
  satker: string;
  gender: Gender | null; // null for legacy rows
  role: string | null; // AttendeeRole code; null for legacy rows
  phone: string | null; // admin only; null otherwise
  signedAtISO: string;
  signedAtLabel: string; // e.g. "Senin, 12 Oktober 2026, 09.05 WIB"
};

export type DeleteAttendanceResult = { ok: true } | { ok: false; message: string };

export type LogBooking = UpcomingBooking & { attendeeCount: number };

// Public-safe meeting summary: no id, booker, satker, phone, or attendee data.
export type PublicMeeting = { agenda: string; startsAt: Date; endsAt: Date; roomName: string };
