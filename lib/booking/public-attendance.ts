import { prisma } from '@/lib/prisma';
import { isUuid } from '@/lib/uuid';

import { isAttendanceOpen, pickActiveMeeting } from './attendance-window';
import { findNextBookingInRoom, findOpenBookingsInRoom } from './queries';
import type { PublicMeeting } from './types';

export type { PublicMeeting } from './types';

// Public-safe room identity for /hadir/[roomId].
export type AttendanceRoom = { id: string; name: string; building: string | null; floor: string | null };

// open: a booking's attendance window contains now. none: nothing open (+ next booking, if any).
// inactive: room deactivated and nothing open (an open booking in an inactive room still accepts attendance, A3).
export type RoomAttendance =
  | { room: AttendanceRoom; state: 'open'; meeting: PublicMeeting }
  | { room: AttendanceRoom; state: 'none'; nextBooking: PublicMeeting | null }
  | { room: AttendanceRoom; state: 'inactive' };

// Server-side choice of the open booking: running now > nearest upcoming > most recently ended (deterministic).
export async function findOpenBooking(
  roomId: string,
  now: Date,
): Promise<{ id: string; startsAt: Date; endsAt: Date; agenda: string } | null> {
  const open = (await findOpenBookingsInRoom(roomId, now)).filter((b) => isAttendanceOpen(b.startsAt, b.endsAt, now));
  return pickActiveMeeting(open, now);
}

// Submit side: the meeting the form showed (identified by its start; unique per room since overlaps are
// rejected) must still be open. `changed` = another meeting is open now (e.g. back-to-back meetings).
export async function findOpenBookingByStart(
  roomId: string,
  startsAtMs: number,
  now: Date,
): Promise<{ booking: { id: string; startsAt: Date; endsAt: Date } | null; changed: boolean }> {
  const open = (await findOpenBookingsInRoom(roomId, now)).filter((b) => isAttendanceOpen(b.startsAt, b.endsAt, now));
  const booking = open.find((b) => b.startsAt.getTime() === startsAtMs) ?? null;
  return { booking, changed: !booking && open.length > 0 };
}

// null = invalid UUID or unknown room (page: notFound()). `now` must come after `io()` in the page.
export async function loadRoomAttendance(roomId: unknown, now: Date = new Date()): Promise<RoomAttendance | null> {
  if (!isUuid(roomId)) return null;
  const room = await prisma.room.findUnique({
    where: { id: roomId.toLowerCase() },
    select: { id: true, name: true, building: true, floor: true, isActive: true },
  });
  if (!room) return null;
  const { isActive, ...publicRoom } = room;

  const open = await findOpenBooking(room.id, now);
  if (open) return { room: publicRoom, state: 'open', meeting: toPublicMeeting(open, room.name) };
  if (!isActive) return { room: publicRoom, state: 'inactive' };
  const next = await findNextBookingInRoom(room.id, now);
  return { room: publicRoom, state: 'none', nextBooking: next ? toPublicMeeting(next, room.name) : null };
}

function toPublicMeeting(b: { agenda: string; startsAt: Date; endsAt: Date }, roomName: string): PublicMeeting {
  return { agenda: b.agenda, startsAt: b.startsAt, endsAt: b.endsAt, roomName };
}
