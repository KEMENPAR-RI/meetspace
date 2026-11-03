import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { authorizeBooking, authorizeUser } from '@/lib/auth/access';
import {
  ATTENDANCE_EXPORT_MAX,
  attendanceFileName,
  toAttendanceSheet,
} from '@/lib/booking/attendance-export';
import { getBookingAttendance } from '@/lib/booking/queries';

const formatSchema = z.enum(['xlsx', 'pdf']);

const CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

const NO_STORE = { 'cache-control': 'private, no-store' };

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

// GET /api/rapat/{id}/export?format=xlsx|pdf
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/rapat/[id]/export'>,
): Promise<Response> {
  // Block cross-site navigations; clients without the header pass.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return jsonError(403, 'Permintaan lintas situs ditolak.');
  }

  // Second gate after the proxy IP allowlist; the session read also defers the clock (io()).
  const user = await authorizeUser();
  if (!user) return jsonError(401, 'Tidak diizinkan.');

  const format = formatSchema.safeParse(request.nextUrl.searchParams.get('format'));
  if (!format.success) return jsonError(400, 'Format tidak valid (xlsx atau pdf).');

  const { id } = await ctx.params;
  // Missing and out-of-scope both 404 (G4).
  const allowed = await authorizeBooking(user, id);
  const data = allowed ? await getBookingAttendance(allowed.id) : null;
  if (!data) return jsonError(404, 'Rapat tidak ditemukan.');

  if (data.attendees.length > ATTENDANCE_EXPORT_MAX) {
    return jsonError(
      413,
      `Data daftar hadir terlalu banyak (lebih dari ${ATTENDANCE_EXPORT_MAX} peserta).`,
    );
  }

  // DTO drops phone/token before reaching the builders.
  const sheet = toAttendanceSheet(data.booking, data.attendees);
  const { buildAttendancePdf, buildAttendanceXlsx } = await import(
    '@/lib/booking/attendance-sheet-export'
  );
  const body =
    format.data === 'xlsx' ? await buildAttendanceXlsx(sheet) : await buildAttendancePdf(sheet);

  return new Response(body, {
    headers: {
      ...NO_STORE,
      'content-type': CONTENT_TYPES[format.data],
      'content-disposition': `attachment; filename="${attendanceFileName(data.booking, format.data)}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}
