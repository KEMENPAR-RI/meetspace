import { roomScopeWhere } from '@/lib/auth/scope';
import type { RoomScope } from '@/lib/auth/types';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { lockRooms, type LockedRoom } from '@/lib/room/lock';

import { LOG_MAX_ROWS } from './log';
import { sortByStatus, startOfTodayJakarta } from './time';
import type { LogBooking, UpcomingBooking } from './types';

// Public room loaders live in lib/room/queries.ts; re-exported for pages.
export { findPublicRoomById, getActiveRooms } from '@/lib/room/queries';

const UPCOMING_LIMIT = 100;

const ROOM_SELECT = { select: { id: true, name: true } } as const;

const BOOKING_SELECT = {
  id: true,
  startsAt: true,
  endsAt: true,
  bookerName: true,
  satker: true,
  agenda: true,
  roomId: true,
  room: ROOM_SELECT,
} as const;

// Public pages pass `roomId`; dashboard must pass `scope` (+ optional `roomId`, intersected with the scope).
export type BookingRoomFilter = { roomId: string; scope?: never } | { scope: RoomScope; roomId?: string };

function roomFilterWhere(filter: BookingRoomFilter): Prisma.BookingWhereInput {
  const parts: Prisma.BookingWhereInput[] = [];
  if (filter.scope) parts.push(roomScopeWhere(filter.scope));
  if (filter.roomId) parts.push({ roomId: filter.roomId });
  return { AND: parts };
}

// Today's bookings (WIB) stay visible all day, even after they end.
// Ordered ongoing, then upcoming, then finished (see sortByStatus).
export async function getUpcomingBookings(now: Date, filter: BookingRoomFilter): Promise<UpcomingBooking[]> {
  const rows = await prisma.booking.findMany({
    where: { endsAt: { gt: startOfTodayJakarta(now) }, ...roomFilterWhere(filter) },
    orderBy: { startsAt: 'asc' },
    take: UPCOMING_LIMIT,
    select: BOOKING_SELECT,
  });
  return sortByStatus(rows, now);
}

// Bookings starting today (WIB), for the dashboard summary. Same status order as getUpcomingBookings.
export async function getTodayBookings(now: Date, filter: BookingRoomFilter): Promise<UpcomingBooking[]> {
  const today = startOfTodayJakarta(now);
  const tomorrow = new Date(today.getTime() + 86_400_000); // WIB has no DST
  const rows = await prisma.booking.findMany({
    where: { startsAt: { gte: today, lt: tomorrow }, ...roomFilterWhere(filter) },
    orderBy: { startsAt: 'asc' },
    take: UPCOMING_LIMIT,
    select: BOOKING_SELECT,
  });
  return sortByStatus(rows, now);
}

// Escape LIKE wildcards; Prisma `contains` passes them through unescaped.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export type LogBookingsResult = { rows: LogBooking[]; truncated: boolean };

type LogRange = { gte: Date; lt: Date };
// `scope` is required: the log is dashboard-only.
export type LogFilter = { satker?: string; bookerName?: string; roomId?: string; scope: RoomScope };

function logWhere(range: LogRange, filter: LogFilter): Prisma.BookingWhereInput {
  return {
    startsAt: { gte: range.gte, lt: range.lt },
    ...roomFilterWhere(filter),
    ...(filter.satker ? { satker: filter.satker } : {}),
    ...(filter.bookerName
      ? { bookerName: { contains: escapeLike(filter.bookerName) } } // _ci collation: case-insensitive
      : {}),
  };
}

// Reservation log: bookings starting in [gte, lt), optionally filtered.
// Fetches one extra row to detect when LOG_MAX_ROWS is exceeded.
export async function getLogBookings(range: LogRange, filter: LogFilter): Promise<LogBookingsResult> {
  if (range.gte >= range.lt) return { rows: [], truncated: false };
  const found = await prisma.booking.findMany({
    where: logWhere(range, filter),
    orderBy: { startsAt: 'asc' },
    take: LOG_MAX_ROWS + 1,
    select: BOOKING_SELECT,
  });
  const truncated = found.length > LOG_MAX_ROWS;
  return { rows: truncated ? found.slice(0, LOG_MAX_ROWS) : found, truncated };
}

// One booking with its room; null when missing. Dashboard callers authorize first.
export async function getBookingDetail(id: string): Promise<UpcomingBooking | null> {
  return prisma.booking.findUnique({ where: { id }, select: BOOKING_SELECT });
}

const SATKER_LIMIT = 200;

// Satker values used in [gte, lt) within the scope; range hits the starts_at index, capped.
export async function getDistinctSatker(
  range: { gte: Date; lt: Date },
  filter: { roomId?: string; scope: RoomScope },
): Promise<string[]> {
  const rows = await prisma.booking.findMany({
    where: { startsAt: { gte: range.gte, lt: range.lt }, satker: { not: '' }, ...roomFilterWhere(filter) },
    distinct: ['satker'],
    orderBy: { satker: 'asc' },
    take: SATKER_LIMIT,
    select: { satker: true },
  });
  return rows.map((r) => r.satker);
}

export type OverlappingSlot = { startsAt: Date; endsAt: Date };

// Half-open overlap within one room; run under lockRoomForWrite to be race-free (ADR 0003).
// `excludeId` skips the booking being edited.
export async function findOverlap(
  roomId: string,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
  db: Prisma.TransactionClient = prisma,
): Promise<OverlappingSlot | null> {
  return db.booking.findFirst({
    where: {
      roomId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { startsAt: 'asc' },
    select: { startsAt: true, endsAt: true },
  });
}

// Serializes time-changing writes per room (ADR 0003, replaces lockBookingWrites); also reads is_active atomically.
export async function lockRoomForWrite(
  tx: Prisma.TransactionClient,
  roomIds: readonly string[],
): Promise<Map<string, LockedRoom>> {
  const rows = await lockRooms(tx, roomIds);
  return new Map(rows.map((r) => [r.id, r]));
}
