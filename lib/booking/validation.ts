import { z } from 'zod';

import {
  addDays,
  isDateString,
  isTimeString,
  isValidCalendarDate,
  toInstant,
  todayInJakarta,
} from './time';
import {
  ATTENDANCE_FIELDS,
  ATTENDANCE_LIMITS,
  ATTENDEE_ROLES,
  GENDERS,
  BOOKING_FIELDS,
  BOOKING_LIMITS,
  type AttendanceField,
  type AttendeeRole,
  type Gender,
  type BookingField,
} from './types';

// Upper bound against junk years.
export const MAX_DAYS_AHEAD = 365;
export const MIN_DURATION_MINUTES = 15;

export type BookingInput = {
  startsAt: Date;
  endsAt: Date;
  bookerName: string;
  satker: string;
  agenda: string;
};

export type BookingFieldErrors = Partial<Record<BookingField, string>>;
export type BookingValues = Partial<Record<BookingField, string>>;

export type ParseBookingOptions = {
  // Edit only: an unchanged start may already be in the past.
  originalStartsAt?: Date;
};

export type ParseBookingResult =
  | { ok: true; data: BookingInput }
  | { ok: false; fieldErrors: BookingFieldErrors; values: BookingValues };

// C0 controls (incl. NUL, which Postgres rejects) and DEL; allows \t, \n, \r.
function hasNoControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return false;
  }
  return true;
}

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(max, `${label} maksimal ${max} karakter.`)
    .refine(hasNoControlChars, `${label} mengandung karakter yang tidak valid.`);

const timeField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi.`)
    .refine(isTimeString, `Format ${label.toLowerCase()} tidak valid (JJ:MM).`);

// Text-only fields; also used alone to edit finished bookings.
const textSchema = z.object({
  bookerName: requiredText('Nama pemesan', BOOKING_LIMITS.bookerName),
  satker: requiredText('Satker/Instansi', BOOKING_LIMITS.satker),
  agenda: requiredText('Agenda', BOOKING_LIMITS.agenda),
});

export type BookingTextInput = z.infer<typeof textSchema>;

export type ParseBookingTextResult =
  | { ok: true; data: BookingTextInput }
  | { ok: false; fieldErrors: BookingFieldErrors; values: BookingValues };

function buildSchema(now: Date, options: ParseBookingOptions = {}) {
  return z
    .object({
      date: z
        .string()
        .trim()
        .min(1, 'Tanggal wajib diisi.')
        .refine(isDateString, 'Format tanggal tidak valid.')
        .refine(isValidCalendarDate, 'Tanggal tidak valid.'),
      startTime: timeField('Jam mulai'),
      endTime: timeField('Jam akhir'),
      ...textSchema.shape,
    })
    // Zod 4 runs this even if other fields failed, so guard the inputs it needs.
    .superRefine((v, ctx) => {
      if (!isValidCalendarDate(v.date) || !isTimeString(v.startTime) || !isTimeString(v.endTime)) {
        return;
      }
      const startsAt = toInstant(v.date, v.startTime);
      const endsAt = toInstant(v.date, v.endTime);
      const startUnchanged = options.originalStartsAt?.getTime() === startsAt.getTime();

      const today = todayInJakarta(now);
      if (!startUnchanged && v.date < today) {
        ctx.addIssue({ code: 'custom', path: ['date'], message: 'Tanggal sudah lewat.' });
        return;
      }
      if (v.date > addDays(today, MAX_DAYS_AHEAD)) {
        ctx.addIssue({
          code: 'custom',
          path: ['date'],
          message: `Tanggal maksimal ${MAX_DAYS_AHEAD} hari dari hari ini.`,
        });
        return;
      }

      if (endsAt <= startsAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['endTime'],
          message: 'Jam akhir harus setelah jam mulai.',
        });
      } else if (endsAt.getTime() - startsAt.getTime() < MIN_DURATION_MINUTES * 60_000) {
        ctx.addIssue({
          code: 'custom',
          path: ['endTime'],
          message: `Durasi minimal ${MIN_DURATION_MINUTES} menit.`,
        });
      }
      if (startUnchanged) {
        // An edit must not turn a booking into a finished one.
        if (endsAt <= now) {
          ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Jam akhir sudah lewat.' });
        }
      } else if (startsAt <= now) {
        ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Jam mulai sudah lewat.' });
      }
    })
    .transform(
      (v): BookingInput => ({
        startsAt: toInstant(v.date, v.startTime),
        endsAt: toInstant(v.date, v.endTime),
        bookerName: v.bookerName,
        satker: v.satker,
        agenda: v.agenda,
      }),
    );
}

// Non-string entries (e.g. File) are treated as empty.
export function readBookingValues(formData: FormData): BookingValues {
  const values: BookingValues = {};
  for (const field of BOOKING_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === 'string' ? raw : '';
  }
  return values;
}

// Pure: pass `now` explicitly in tests.
export function parseBookingInput(
  formData: FormData,
  now: Date = new Date(),
  options?: ParseBookingOptions,
): ParseBookingResult {
  const values = readBookingValues(formData);
  const result = buildSchema(now, options).safeParse(values);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, fieldErrors: toFieldErrors(result.error.issues), values };
}

// Only bookerName/satker/agenda are read; date/time are ignored even if sent.
export function readBookingTextValues(formData: FormData): BookingValues {
  const all = readBookingValues(formData);
  return { bookerName: all.bookerName, satker: all.satker, agenda: all.agenda };
}

export function parseBookingText(formData: FormData): ParseBookingTextResult {
  const values = readBookingTextValues(formData);
  const result = textSchema.safeParse(values);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, fieldErrors: toFieldErrors(result.error.issues), values };
}

// First message per field.
function toFieldErrors(issues: z.core.$ZodIssue[]): BookingFieldErrors {
  const fieldErrors: BookingFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && isBookingField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

function isBookingField(value: string): value is BookingField {
  return (BOOKING_FIELDS as readonly string[]).includes(value);
}

// Any UUID version (matches Char(36) uuid ids).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBookingId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// Matches the attendances.name_key column width.
const NAME_KEY_MAX = 150;

export type AttendanceInput = {
  name: string;
  nameKey: string;
  satker: string;
  gender: Gender;
  role: AttendeeRole;
  phone: string | null;
};
export type AttendanceFieldErrors = Partial<Record<AttendanceField, string>>;
export type AttendanceValues = Partial<Record<AttendanceField, string>>;

export type ParseAttendanceResult =
  | { ok: true; data: AttendanceInput }
  | { ok: false; fieldErrors: AttendanceFieldErrors; values: AttendanceValues };

const INVISIBLE_CHARS = /[\u00AD\u034F\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

// Zero-width and bidi controls would defeat dedup and spoof display.
export function stripInvisible(value: string): string {
  return value.replace(INVISIBLE_CHARS, '');
}

// Invisible chars removed, NFC, trimmed, any whitespace run (incl. tabs/newlines) collapsed to one space.
export function normalizeName(value: string): string {
  return stripInvisible(value).normalize('NFC').trim().replace(/\s+/g, ' ');
}

const PHONE_SEPARATORS = /[\s\-.()]/g;
const PHONE_PATTERN = /^628\d{8,11}$/;
const PHONE_MESSAGE = 'Format No HP tidak valid (contoh 0812xxxxxxxx).';

// 08xx / +628xx / 628xx -> 628xx; '' -> null; undefined = invalid.
export function normalizePhone(raw: string): string | null | undefined {
  if (raw.length > ATTENDANCE_LIMITS.phoneRaw || !hasNoControlChars(raw)) return undefined;
  let digits = raw.replace(PHONE_SEPARATORS, '');
  if (digits === '') return null;
  if (digits.startsWith('+62')) digits = digits.slice(1);
  else if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return PHONE_PATTERN.test(digits) ? digits : undefined;
}

const attendanceSchema = z.object({
  attendeeName: z
    .string()
    .transform(normalizeName)
    .pipe(
      z
        .string()
        .min(1, 'Nama wajib diisi.')
        .min(ATTENDANCE_LIMITS.attendeeNameMin, `Nama minimal ${ATTENDANCE_LIMITS.attendeeNameMin} karakter.`)
        .max(ATTENDANCE_LIMITS.attendeeName, `Nama maksimal ${ATTENDANCE_LIMITS.attendeeName} karakter.`)
        .refine(hasNoControlChars, 'Nama mengandung karakter yang tidak valid.'),
    ),
  satker: z
    .string()
    .transform(stripInvisible)
    .pipe(requiredText('Satker/Instansi', ATTENDANCE_LIMITS.satker)),
  gender: z.enum(GENDERS, 'Pilih jenis kelamin.'),
  role: z.enum(ATTENDEE_ROLES, 'Pilih peran kehadiran.'),
  phone: z
    .string()
    .transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (phone === undefined) {
        ctx.addIssue({ code: 'custom', message: PHONE_MESSAGE });
        return z.NEVER;
      }
      return phone;
    }),
});

// Non-string entries (e.g. File) are treated as empty.
export function readAttendanceValues(formData: FormData): AttendanceValues {
  const values: AttendanceValues = {};
  for (const field of ATTENDANCE_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === 'string' ? raw : '';
  }
  return values;
}

export function parseAttendanceInput(formData: FormData): ParseAttendanceResult {
  const values = readAttendanceValues(formData);
  const result = attendanceSchema.safeParse(values);
  const fieldErrors: AttendanceFieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && isAttendanceField(field) && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
  }

  const name = normalizeName(values.attendeeName ?? '');
  const nameKey = name.toLowerCase();
  if (!fieldErrors.attendeeName && nameKey.length > NAME_KEY_MAX) {
    fieldErrors.attendeeName = 'Nama mengandung karakter yang tidak valid.';
  }

  if (!result.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }
  const { attendeeName, satker, gender, role, phone } = result.data;
  return { ok: true, data: { name: attendeeName, nameKey, satker, gender, role, phone } };
}

function isAttendanceField(value: string): value is AttendanceField {
  return (ATTENDANCE_FIELDS as readonly string[]).includes(value);
}
