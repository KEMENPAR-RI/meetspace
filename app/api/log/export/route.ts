import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { authorizeUser, canAccessRoom, getRoomScope } from '@/lib/auth/access';
import { LOG_MAX_ROWS, parseLogFilters, resolveRange, toExportRows } from '@/lib/booking/log';
import { getLogBookings } from '@/lib/booking/queries';
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

  // Session + role gate; the session read also defers the clock (io()).
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
  const rows = toExportRows(bookings);

  const { buildLogPdf, buildLogXlsx } = await import('@/lib/booking/log-export');
  const title = `Log Reservasi ${filters.year}`;
  // PDF heading carries the institution / app name; the XLSX sheet name stays short (Excel: 31 chars).
  const { appName, institutionName } = await getAppearance();
  const body =
    format.data === 'xlsx'
      ? await buildLogXlsx(rows, title)
      : await buildLogPdf(rows, `${institutionName ?? appName} - ${title}`);

  return new Response(body, {
    headers: {
      ...NO_STORE,
      'content-type': CONTENT_TYPES[format.data],
      'content-disposition': `attachment; filename="log-reservasi-${filters.year}.${format.data}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}
