import type { AttendeeRow } from '@/lib/booking/queries';
import {
  formatDateLabel,
  formatTime,
  formatTimeRange,
  toJakartaDateString,
  toJakartaTimeInput,
  APP_TZ_LABEL,
} from '@/lib/booking/time';
import { attendeeRoleLabel, genderCode } from '@/lib/booking/types';
import { roomFileLabel } from '@/lib/room/file-name';

// Light module (no exceljs/pdfkit): safe to import from the route.

// Guard against oversized exports (public /hadir spam).
export const ATTENDANCE_EXPORT_MAX = 1000;

export const ATTENDANCE_SHEET_COLUMNS = [
  'No',
  'Nama',
  'Jenis Kelamin',
  'Satker/Instansi',
  'Jabatan',
  'Waktu Hadir',
  'Tanda Tangan',
] as const;

// Index of the signature column (drawn in a script font in PDF).
export const ATTENDANCE_SIGNATURE_COL = 6;

export type AttendanceSheet = {
  title: string;
  info: [label: string, value: string][];
  header: string[];
  rows: string[][];
  emptyText: string;
};

type SheetBooking = { startsAt: Date; endsAt: Date; agenda: string; room: { id: string; name: string } };
// No phone: builders cannot print it.
type SheetAttendee = Pick<AttendeeRow, 'name' | 'gender' | 'satker' | 'role' | 'signedAt'>;

// e.g. "daftar-hadir-2026-11-03-0900-ruang-rapat-00000000.pdf"
export function attendanceFileName(booking: Pick<SheetBooking, 'startsAt' | 'room'>, ext: string): string {
  const time = toJakartaTimeInput(booking.startsAt).replace(':', '');
  return `daftar-hadir-${toJakartaDateString(booking.startsAt)}-${time}-${roomFileLabel(booking.room)}.${ext}`;
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
      ['Tempat', booking.room.name],
    ],
    header: [...ATTENDANCE_SHEET_COLUMNS],
    rows: attendees.map((a, i) => [
      String(i + 1),
      a.name,
      genderCode(a.gender),
      a.satker,
      attendeeRoleLabel(a.role),
      `${formatTime(a.signedAt)} ${APP_TZ_LABEL}`,
      a.name, // signature = name (as in the UI)
    ]),
    emptyText: 'Belum ada peserta yang hadir',
  };
}
