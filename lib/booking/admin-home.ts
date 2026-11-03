import { isSuperadmin } from '@/lib/auth/scope';
import type { CurrentUser } from '@/lib/auth/types';
import { prisma } from '@/lib/prisma';
import { findPublicRoomById } from '@/lib/room/queries';
import type { RoomDetail } from '@/lib/room/types';

import { getTodayBookings, getUpcomingBookings } from './queries';
import { startOfTodayJakarta } from './time';
import type { UpcomingBooking } from './types';

const UPCOMING_LIMIT = 20;

export type AdminHome = {
  room: RoomDetail;
  // Running now (startsAt <= now < endsAt), with attendee count.
  current: (UpcomingBooking & { attendeeCount: number }) | null;
  // Starting today (WIB), incl. finished ones.
  today: UpcomingBooking[];
  // Starting after today, nearest first.
  upcoming: UpcomingBooking[];
};

// Admin home: the single assigned room; null for superadmin or an admin not assigned yet. Call after io().
export async function loadAdminHome(user: CurrentUser, now: Date = new Date()): Promise<AdminHome | null> {
  if (isSuperadmin(user) || user.roomIds.length === 0) return null;
  const roomId = user.roomIds[0];
  const room = await findPublicRoomById(roomId);
  if (!room) return null;

  const tomorrow = new Date(startOfTodayJakarta(now).getTime() + 86_400_000); // WIB has no DST
  const [today, later, current] = await Promise.all([
    getTodayBookings(now, { roomId }),
    getUpcomingBookings(now, { roomId }),
    prisma.booking.findFirst({
      where: { roomId, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, _count: { select: { attendances: true } } },
    }),
  ]);

  const running = current ? today.find((b) => b.id === current.id) ?? null : null;
  return {
    room,
    current: running && current ? { ...running, attendeeCount: current._count.attendances } : null,
    today,
    upcoming: later.filter((b) => b.startsAt >= tomorrow).slice(0, UPCOMING_LIMIT),
  };
}
