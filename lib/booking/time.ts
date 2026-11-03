// WIB helpers. Asia/Jakarta is a fixed +07:00 offset (no DST).

export const APP_TIMEZONE = 'Asia/Jakarta';
export const APP_TZ_OFFSET = '+07:00';
export const APP_TZ_LABEL = 'WIB';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateString(value: string): boolean {
  return DATE_RE.test(value);
}

export function isTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

// Rejects shapes like 2026-02-30 via round-trip.
export function isValidCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Form date + time (WIB) -> instant.
export function toInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${APP_TZ_OFFSET}`);
}

const dateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Calendar date (YYYY-MM-DD) of an instant in Jakarta.
export function toJakartaDateString(instant: Date): string {
  const parts = dateKeyFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// en-US + h23 gives "HH:mm" for <input type="time">; id-ID would give "09.00".
const timeInputFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Time (HH:mm, 24h) of an instant in Jakarta.
export function toJakartaTimeInput(instant: Date): string {
  const parts = timeInputFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}`;
}

export function todayInJakarta(now: Date = new Date()): string {
  return toJakartaDateString(now);
}

// 00:00 WIB of now's Jakarta calendar date.
export function startOfTodayJakarta(now: Date): Date {
  return toInstant(toJakartaDateString(now), '00:00');
}

export type BookingStatus = 'upcoming' | 'ongoing' | 'done';

// Half-open [startsAt, endsAt), same rule as the overlap check.
export function getBookingStatus(startsAt: Date, endsAt: Date, now: Date): BookingStatus {
  if (now < startsAt) return 'upcoming';
  if (now < endsAt) return 'ongoing';
  return 'done';
}

const STATUS_ORDER: Record<BookingStatus, number> = { ongoing: 0, upcoming: 1, done: 2 };

// Ongoing first, then upcoming, finished last; start time ascending within each group.
export function sortByStatus<T extends { startsAt: Date; endsAt: Date }>(bookings: T[], now: Date): T[] {
  return bookings
    .map((b) => ({ b, rank: STATUS_ORDER[getBookingStatus(b.startsAt, b.endsAt, now)] }))
    .sort((x, y) => x.rank - y.rank || x.b.startsAt.getTime() - y.b.startsAt.getTime())
    .map(({ b }) => b);
}

// Pure calendar arithmetic on a YYYY-MM-DD string.
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dateLabelFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: APP_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// e.g. "Senin, 12 Oktober 2026"
export function formatDateLabel(instant: Date): string {
  return dateLabelFormatter.format(instant);
}

// e.g. "09.00"
export function formatTime(instant: Date): string {
  return timeFormatter.format(instant);
}

// e.g. "09.00–10.00 WIB"
export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)}–${formatTime(end)} ${APP_TZ_LABEL}`;
}
