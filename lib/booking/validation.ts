import { z } from 'zod';

import {
  addDays,
  isDateString,
  isTimeString,
  isValidCalendarDate,
  toInstant,
  todayInJakarta,
} from './time';
import { BOOKING_FIELDS, BOOKING_LIMITS, type BookingField } from './types';

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
