import type { AttendeeRow } from '@/lib/booking/queries';
import {
  formatDateLabel,
  formatTime,
  formatTimeRange,
  toJakartaDateString,
  toJakartaTimeInput,
  APP_TZ_LABEL,
} from '@/lib/booking/time';
import { attendeeRoleLabel } from '@/lib/booking/types';

// Light module (no exceljs/pdfkit): safe to import from the route.

// Single meeting room; no per-booking place field.
export const ATTENDANCE_PLACE = 'BIRODATIN';

// Guard against oversized exports (public /hadir spam).
export const ATTENDANCE_EXPORT_MAX = 1000;

export const ATTENDANCE_SHEET_COLUMNS = [
  'No',
  'Nama',
  'Divisi/Instansi',
  'Jabatan',
  'Waktu Hadir',
  'Tanda Tangan',
] as const;

// Index of the signature column (drawn in a script font in PDF).
export const ATTENDANCE_SIGNATURE_COL = 5;

export type AttendanceSheet = {
  title: string;
  info: [label: string, value: string][];
  header: string[];
  rows: string[][];
  emptyText: string;
};

type SheetBooking = { startsAt: Date; endsAt: Date; agenda: string };
// No phone: builders cannot print it.
type SheetAttendee = Pick<AttendeeRow, 'name' | 'division' | 'role' | 'signedAt'>;

// e.g. "daftar-hadir-2026-11-03-0900.pdf"
export function attendanceFileName(startsAt: Date, ext: string): string {
  const time = toJakartaTimeInput(startsAt).replace(':', '');
  return `daftar-hadir-${toJakartaDateString(startsAt)}-${time}.${ext}`;
}

export function toAttendanceSheet(
  booking: SheetBooking,
  attendees: readonly SheetAttendee[],
): AttendanceSheet {
  return {
    title: 'DAFTAR HADIR',
    info: [
      ['Hari/Tanggal', formatDateLabel(booking.startsAt)],
      ['Kegiatan', booking.agenda],
      ['Waktu', formatTimeRange(booking.startsAt, booking.endsAt)],
      ['Tempat', ATTENDANCE_PLACE],
    ],
    header: [...ATTENDANCE_SHEET_COLUMNS],
    rows: attendees.map((a, i) => [
      String(i + 1),
      a.name,
      a.division,
      attendeeRoleLabel(a.role),
      `${formatTime(a.signedAt)} ${APP_TZ_LABEL}`,
      a.name, // signature = name (as in the UI)
    ]),
    emptyText: 'Belum ada peserta yang hadir',
  };
}
