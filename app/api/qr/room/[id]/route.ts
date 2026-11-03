import type { NextRequest } from 'next/server';

import { authorizeUser, canAccessRoom } from '@/lib/auth/access';
import { PUBLIC_URL_MISSING, roomBookingUrl } from '@/lib/public-url';
import { isCrossSite, qrJsonError, qrResponse } from '@/lib/qr/response';
import { roomFileLabel } from '@/lib/room/file-name';
import { findPublicRoomById } from '@/lib/room/queries';

// GET /api/qr/room/{id}[?format=svg][&download=1] -> QR of `${APP_URL}/ruang/<roomId>` (J1/J3/J6).
export async function GET(request: NextRequest, ctx: RouteContext<'/api/qr/room/[id]'>): Promise<Response> {
  if (isCrossSite(request)) return qrJsonError(403, 'Permintaan lintas situs ditolak.');

  const user = await authorizeUser();
  if (!user) return qrJsonError(401, 'Tidak diizinkan.');

  const { id } = await ctx.params;
  // Out-of-scope and missing rooms both 404 (G4).
  const room = canAccessRoom(user, id.toLowerCase()) ? await findPublicRoomById(id) : null;
  if (!room) return qrJsonError(404, 'Ruangan tidak ditemukan.');

  const url = roomBookingUrl(room.id);
  if (!url) return qrJsonError(503, PUBLIC_URL_MISSING);

  return qrResponse(request, url, `qr-booking-${roomFileLabel(room)}`);
}
