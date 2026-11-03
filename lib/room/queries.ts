import { getRoomScope, isSuperadmin } from '@/lib/auth/scope';
import type { CurrentUser } from '@/lib/auth/types';
import { prisma } from '@/lib/prisma';
import { isUuid } from '@/lib/uuid';

import type { AssignableAdmin, DashboardRoom, PublicRoom, RoomDetail, RoomForEdit, RoomOption } from './types';

const PUBLIC_SELECT = { id: true, name: true, building: true, floor: true, capacity: true } as const;
const DETAIL_SELECT = { ...PUBLIC_SELECT, facilities: true, isActive: true } as const;
const ACTIVE_PJ = { user: { isActive: true, role: 'ADMIN' as const } };

// Public home (C1): active rooms by name.
export async function getActiveRooms(): Promise<PublicRoom[]> {
  return prisma.room.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: PUBLIC_SELECT });
}

// Public room page; inactive rooms are returned (page shows "Ruangan tidak tersedia", A3).
export async function findPublicRoomById(id: unknown): Promise<RoomDetail | null> {
  if (!isUuid(id)) return null;
  return prisma.room.findUnique({ where: { id: id.toLowerCase() }, select: DETAIL_SELECT });
}

// Rooms the user may see (filters, move-booking select); superadmin = all.
export async function getScopeRooms(user: CurrentUser, { activeOnly = false } = {}): Promise<RoomOption[]> {
  const scope = getRoomScope(user);
  return prisma.room.findMany({
    where: { ...(scope.all ? {} : { id: { in: scope.roomIds } }), ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isActive: true },
  });
}

// Dashboard summary / superadmin room list.
export async function getDashboardRooms(user: CurrentUser): Promise<DashboardRoom[]> {
  const scope = getRoomScope(user);
  const rows = await prisma.room.findMany({
    where: scope.all ? {} : { id: { in: scope.roomIds } },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      ...DETAIL_SELECT,
      admins: {
        where: ACTIVE_PJ,
        orderBy: { createdAt: 'asc' },
        select: { user: { select: { id: true, name: true, username: true } } },
      },
      _count: { select: { bookings: true } },
    },
  });
  return rows.map(({ admins, _count, ...room }) => ({
    ...room,
    admins: admins.map((a) => a.user),
    bookingCount: _count.bookings,
  }));
}

// Superadmin edit form; null when missing or caller is not superadmin.
export async function getRoomForEdit(user: CurrentUser, id: string): Promise<RoomForEdit | null> {
  if (!isSuperadmin(user) || !isUuid(id)) return null;
  const row = await prisma.room.findUnique({
    where: { id },
    select: {
      ...DETAIL_SELECT,
      admins: { where: ACTIVE_PJ, select: { userId: true } },
      _count: { select: { bookings: true } },
    },
  });
  if (!row) return null;
  const { admins, _count, ...room } = row;
  return { ...room, adminIds: admins.map((a) => a.userId), bookingCount: _count.bookings };
}

// PJ candidates (F1): active admin-role accounts, with their current room (form: disable/flag taken ones).
export async function getAssignableAdmins(): Promise<AssignableAdmin[]> {
  const rows = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, username: true, rooms: { take: 1, select: { room: { select: { id: true, name: true } } } } },
  });
  return rows.map(({ rooms, ...u }) => ({ ...u, room: rooms[0]?.room ?? null }));
}
