import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { authorizeUser, canAccessRoom, getRoomScope } from '@/lib/auth/access';
import {
  LOG_MAX_ATTENDEES,
  LOG_MAX_ROWS,
  parseLogFilters,
  resolveRange,
  toAttendeeExport,
  toExportRows,
} from '@/lib/booking/log';
import { getLogAttendees, getLogBookings } from '@/lib/booking/queries';
import { getAppearance } from '@/lib/settings/queries';

const formatSchema = z.enum(['xlsx', 'pdf']);

const CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

const NO_STORE = { 'cache-control': 'private, no-store' };

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

// GET /api/log/export?format=xlsx|pdf&room=&year=&satker=&dateStart=&dateEnd=&bookerName=
export async function GET(request: NextRequest): Promise<Response> {
  // Block cross-site navigations; clients without the header pass.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return jsonError(403, 'Permintaan lintas situs ditolak.');
  }

  // Second gate after the proxy IP allowlist; the session read also defers the clock (io()).
  const user = await authorizeUser();
  if (!user) return jsonError(401, 'Tidak diizinkan.');

  const params = request.nextUrl.searchParams;
  const format = formatSchema.safeParse(params.get('format'));
  if (!format.success) return jsonError(400, 'Format tidak valid (xlsx atau pdf).');

  // Same parser as the page, so the export matches the active filter.
  const filters = parseLogFilters(params);
  // Out-of-scope room looks like a missing one (G4).
  if (filters.room && !canAccessRoom(user, filters.room)) return jsonError(404, 'Ruangan tidak ditemukan.');
  const range = resolveRange(filters);
  const filter = {
    satker: filters.satker,
    bookerName: filters.bookerName,
    roomId: filters.room,
    scope: getRoomScope(user),
  };
  const { rows: bookings, truncated } = await getLogBookings(range, filter);
  if (truncated) {
    return jsonError(
      413,
      `Data terlalu banyak (lebih dari ${LOG_MAX_ROWS} reservasi). Persempit filter terlebih dahulu.`,
    );
  }
  const attendees = await getLogAttendees(range, filter);
  if (attendees.truncated) {
    return jsonError(
      413,
      `Data daftar hadir terlalu banyak (lebih dari ${LOG_MAX_ATTENDEES} baris). Persempit filter terlebih dahulu.`,
    );
  }
  const rows = toExportRows(bookings);
  const { sheetRows, linesByRow } = toAttendeeExport(bookings, attendees.rows);

  const { buildLogPdf, buildLogXlsx } = await import('@/lib/booking/log-export');
  const title = `Log Reservasi ${filters.year}`;
  // PDF heading carries the institution / app name; the XLSX sheet name stays short (Excel: 31 chars).
  const { appName, institutionName } = await getAppearance();
  const body =
    format.data === 'xlsx'
      ? await buildLogXlsx(rows, title, sheetRows)
      : await buildLogPdf(rows, `${institutionName ?? appName} - ${title}`, linesByRow);

  return new Response(body, {
    headers: {
      ...NO_STORE,
      'content-type': CONTENT_TYPES[format.data],
      'content-disposition': `attachment; filename="log-reservasi-${filters.year}.${format.data}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}
