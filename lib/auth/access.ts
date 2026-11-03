import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';

import { prisma } from '@/lib/prisma';
import { isUuid } from '@/lib/uuid';

import { canAccessRoom, getRoomScope, isSuperadmin, roomScopeWhere } from './scope';
import { readSessionToken } from './session';
import { findSessionUser } from './session-store';
import type { CurrentUser } from './types';

// Single authorization gate (ADR 0003). Server-only: never import from a client component.
export { canAccessRoom, getRoomScope, isSuperadmin, roomScopeWhere, scopeIncludesRoom } from './scope';

export const LOGIN_PATH = '/dashboard/login';

// Cookie token -> unexpired session row of an active user; deduped per request. Never 'use cache'.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  try {
    return await findSessionUser(token, new Date());
  } catch (error) {
    unstable_rethrow(error);
    console.error('[auth] getCurrentUser failed', error);
    return null;
  }
});

// Pages: no session -> login page.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

// Pages: admins get the same 404 as a missing page (G4).
export async function requireSuperadmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isSuperadmin(user)) notFound();
  return user;
}

// Actions/route handlers: session only (dashboard is not office-IP gated); null = answer "Tidak diizinkan.".
export async function authorizeUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}

export async function authorizeSuperadmin(): Promise<CurrentUser | null> {
  const user = await authorizeUser();
  return user && isSuperadmin(user) ? user : null;
}

export type AuthorizedBooking = { id: string; roomId: string; startsAt: Date; endsAt: Date };

// Missing and out-of-scope bookings both return null (no existence oracle).
export async function authorizeBooking(user: CurrentUser, bookingId: unknown): Promise<AuthorizedBooking | null> {
  if (!isUuid(bookingId)) return null;
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...roomScopeWhere(getRoomScope(user)) },
    select: { id: true, roomId: true, startsAt: true, endsAt: true },
  });
  return booking;
}

export type AuthorizedAttendance = { id: string; bookingId: string; roomId: string };

export async function authorizeAttendance(
  user: CurrentUser,
  attendanceId: unknown,
): Promise<AuthorizedAttendance | null> {
  if (!isUuid(attendanceId)) return null;
  const found = await prisma.attendance.findFirst({
    where: { id: attendanceId, booking: roomScopeWhere(getRoomScope(user)) },
    select: { id: true, bookingId: true, booking: { select: { roomId: true } } },
  });
  return found ? { id: found.id, bookingId: found.bookingId, roomId: found.booking.roomId } : null;
}

// Pages: session + booking in scope, else login / 404.
export async function requireBookingAccess(
  bookingId: unknown,
): Promise<{ user: CurrentUser; booking: AuthorizedBooking }> {
  const user = await requireUser();
  const booking = await authorizeBooking(user, bookingId);
  if (!booking) notFound();
  return { user, booking };
}

// Pages: session + room in scope (room must exist), else login / 404.
export async function requireRoomAccess(roomId: unknown): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isUuid(roomId) || !canAccessRoom(user, roomId)) notFound();
  const exists = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
  if (!exists) notFound();
  return user;
}
