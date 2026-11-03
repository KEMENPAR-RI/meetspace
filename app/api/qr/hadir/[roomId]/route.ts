import type { NextRequest } from 'next/server';

import { authorizeUser, canAccessRoom } from '@/lib/auth/access';
import { attendanceUrl, PUBLIC_URL_MISSING } from '@/lib/public-url';
import { isCrossSite, qrJsonError, qrResponse } from '@/lib/qr/response';
import { roomFileLabel } from '@/lib/room/file-name';
import { findPublicRoomById } from '@/lib/room/queries';

// GET /api/qr/hadir/{roomId}[?format=svg][&download=1] -> QR of `${APP_URL}/hadir/<roomId>`.
// Superadmin: any room; admin: only the assigned room (missing/out-of-scope both 404).
export async function GET(request: NextRequest, ctx: RouteContext<'/api/qr/hadir/[roomId]'>): Promise<Response> {
  if (isCrossSite(request)) return qrJsonError(403, 'Permintaan lintas situs ditolak.');

  const user = await authorizeUser();
  if (!user) return qrJsonError(401, 'Tidak diizinkan.');

  const { roomId } = await ctx.params;
  const room = canAccessRoom(user, roomId.toLowerCase()) ? await findPublicRoomById(roomId) : null;
  if (!room) return qrJsonError(404, 'Ruangan tidak ditemukan.');

  const url = attendanceUrl(room.id);
  if (!url) return qrJsonError(503, PUBLIC_URL_MISSING);

  return qrResponse(request, url, `qr-hadir-${roomFileLabel(room)}`);
}
