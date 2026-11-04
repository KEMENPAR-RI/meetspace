import { z } from 'zod';

import {
  addDays,
  formatTime,
  isValidCalendarDate,
  toInstant,
  toJakartaDateString,
  todayInJakarta,
} from './time';
import { isUuid } from '@/lib/uuid';

import { BOOKING_LIMITS, type LogBooking } from './types';

// Shared contract for the reservation log page, its client components, and the export route.

export type LogFilters = {
  year: number;
  room?: string; // room id; callers must check it against the user's scope
  satker?: string;
  dateStart?: string; // WIB YYYY-MM-DD
  dateEnd?: string; // WIB YYYY-MM-DD
  bookerName?: string;
};

// Serializable: ISO strings and ready-made labels, no Date objects.
export type LogEntry = {
  id: string;
  dateKey: string; // WIB YYYY-MM-DD of startsAt
  startISO: string;
  endISO: string;
  startLabel: string; // e.g. "09.00" (WIB)
  endLabel: string;
  bookerName: string;
  satker: string;
  agenda: string;
  roomId: string;
  roomName: string;
};

export type LogDay = { dateKey: string; count: number; entries: LogEntry[] };

export type LogData = { year: number; days: LogDay[]; satkers: string[]; total: number };

export type LogSearchParams = URLSearchParams | Record<string, string | string[] | undefined>;

export const LOG_YEAR_MIN = 2000;
export const LOG_YEAR_MAX = 2100;
// Hard cap for the log page and export; above it the user must narrow the filter.
export const LOG_MAX_ROWS = 5000;
export { RESET_CONFIRMATION } from './types';

// Rejects C0 controls and DEL (Postgres rejects NUL).
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const yearSchema = z.coerce.number().int().min(LOG_YEAR_MIN).max(LOG_YEAR_MAX);
const dateSchema = z.string().trim().refine(isValidCalendarDate);
const textSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !CONTROL_CHARS.test(v));

function readParam(params: LogSearchParams, key: string): string | undefined {
  const raw = params instanceof URLSearchParams ? params.get(key) : params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : undefined;
}

function pick<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  if (value === undefined) return undefined;
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

// Invalid or missing params fall back to defaults; never throws. Call `io()` first under Cache Components.
export function parseLogFilters(params: LogSearchParams, now: Date = new Date()): LogFilters {
  const defaultYear = Number(todayInJakarta(now).slice(0, 4));
  const filters: LogFilters = { year: pick(yearSchema, readParam(params, 'year')) ?? defaultYear };

  const room = readParam(params, 'room');
  const satker = pick(textSchema(BOOKING_LIMITS.satker), readParam(params, 'satker'));
  const dateStart = pick(dateSchema, readParam(params, 'dateStart'));
  const dateEnd = pick(dateSchema, readParam(params, 'dateEnd'));
  const bookerName = pick(textSchema(BOOKING_LIMITS.bookerName), readParam(params, 'bookerName'));

  if (isUuid(room)) filters.room = room.toLowerCase();
  if (satker) filters.satker = satker;
  if (dateStart) filters.dateStart = dateStart;
  if (dateEnd) filters.dateEnd = dateEnd;
  if (bookerName) filters.bookerName = bookerName;
  return filters;
}

// Year window (WIB) intersected with the optional date range; empty when gte >= lt.
export function resolveRange(f: LogFilters): { gte: Date; lt: Date } {
  const yearStart = toInstant(`${f.year}-01-01`, '00:00');
  const yearEnd = toInstant(`${f.year + 1}-01-01`, '00:00');
  const gte = f.dateStart ? maxDate(yearStart, toInstant(f.dateStart, '00:00')) : yearStart;
  const lt = f.dateEnd ? minDate(yearEnd, toInstant(addDays(f.dateEnd, 1), '00:00')) : yearEnd;
  return { gte, lt };
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function toLogEntry(row: LogBooking): LogEntry {
  return {
    id: row.id,
    dateKey: toJakartaDateString(row.startsAt),
    startISO: row.startsAt.toISOString(),
    endISO: row.endsAt.toISOString(),
    startLabel: formatTime(row.startsAt),
    endLabel: formatTime(row.endsAt),
    bookerName: row.bookerName,
    satker: row.satker,
    agenda: row.agenda,
    roomId: row.roomId,
    roomName: row.room.name,
  };
}

// Groups by WIB day of startsAt; days and entries ordered by start.
export function buildLogData(rows: LogBooking[], f: LogFilters, satkers: string[]): LogData {
  const sorted = [...rows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const byDay = new Map<string, LogEntry[]>();
  for (const row of sorted) {
    const entry = toLogEntry(row);
    const list = byDay.get(entry.dateKey);
    if (list) list.push(entry);
    else byDay.set(entry.dateKey, [entry]);
  }

  const days: LogDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, entries]) => ({ dateKey, count: entries.length, entries }));

  return { year: f.year, days, satkers, total: sorted.length };
}

export const EXPORT_COLUMNS = [
  'Tanggal',
  'Jam Mulai',
  'Jam Selesai',
  'Ruangan',
  'Pemesan',
  'Satker/Instansi',
  'Agenda',
] as const;

// Header row plus one row per booking; empty input yields the header only.
export function toExportRows(rows: LogBooking[]): string[][] {
  const sorted = sortByStart(rows);
  return [
    [...EXPORT_COLUMNS],
    ...sorted.map((row) => [
      toJakartaDateString(row.startsAt),
      formatTime(row.startsAt),
      formatTime(row.endsAt),
      row.room.name,
      row.bookerName,
      row.satker,
      row.agenda,
    ]),
  ];
}

function sortByStart(rows: LogBooking[]): LogBooking[] {
  return [...rows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
