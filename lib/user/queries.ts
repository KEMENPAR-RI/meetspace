import { isSuperadmin } from '@/lib/auth/scope';
import type { CurrentUser } from '@/lib/auth/types';
import { prisma } from '@/lib/prisma';
import { isUuid } from '@/lib/uuid';

import type { UserForEdit, UserListItem } from './types';

const USER_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  rooms: { orderBy: { room: { name: 'asc' } }, select: { room: { select: { id: true, name: true } } } },
} as const;

// Superadmin only; [] for anyone else.
export async function listUsers(user: CurrentUser): Promise<UserListItem[]> {
  if (!isSuperadmin(user)) return [];
  const rows = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: { ...USER_SELECT, createdAt: true },
  });
  return rows.map(({ rooms, ...u }) => ({ ...u, rooms: rooms.map((r) => r.room) }));
}

// Superadmin only; null when missing or not allowed.
export async function getUserForEdit(user: CurrentUser, id: string): Promise<UserForEdit | null> {
  if (!isSuperadmin(user) || !isUuid(id)) return null;
  const row = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!row) return null;
  const { rooms, ...u } = row;
  return { ...u, rooms: rooms.map((r) => r.room) };
}
