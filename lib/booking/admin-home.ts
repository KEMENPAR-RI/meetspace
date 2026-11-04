import { isSuperadmin } from '@/lib/auth/scope';
import type { CurrentUser } from '@/lib/auth/types';
import { findPublicRoomById } from '@/lib/room/queries';
import type { RoomDetail } from '@/lib/room/types';

import { getTodayBookings, getUpcomingBookings } from './queries';
import { startOfTodayJakarta } from './time';
import type { UpcomingBooking } from './types';

const UPCOMING_LIMIT = 20;

export type AdminHome = {
  room: RoomDetail;
  // Running now (startsAt <= now < endsAt).
  current: UpcomingBooking | null;
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
  const [today, later] = await Promise.all([
    getTodayBookings(now, { roomId }),
    getUpcomingBookings(now, { roomId }),
  ]);

  // `today` lists ongoing first, earliest start first (sortByStatus).
  const current = today.find((b) => b.startsAt <= now && b.endsAt > now) ?? null;
  return {
    room,
    current,
    today,
    upcoming: later.filter((b) => b.startsAt >= tomorrow).slice(0, UPCOMING_LIMIT),
  };
}
