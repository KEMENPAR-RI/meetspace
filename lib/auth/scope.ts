import type { CurrentUser, RoomScope } from './types';

// Pure scope helpers; re-exported from lib/auth/access.ts.

export function isSuperadmin(user: Pick<CurrentUser, 'role'>): boolean {
  return user.role === 'SUPERADMIN';
}

export function getRoomScope(user: CurrentUser): RoomScope {
  return isSuperadmin(user) ? { all: true } : { all: false, roomIds: user.roomIds };
}

// Prisma `where` fragment for any model with `roomId`; must be part of every dashboard query.
export function roomScopeWhere(scope: RoomScope): { roomId?: { in: string[] } } {
  return scope.all ? {} : { roomId: { in: scope.roomIds } };
}

export function scopeIncludesRoom(scope: RoomScope, roomId: string): boolean {
  return scope.all || scope.roomIds.includes(roomId);
}

export function canAccessRoom(user: CurrentUser, roomId: string): boolean {
  return scopeIncludesRoom(getRoomScope(user), roomId);
}
