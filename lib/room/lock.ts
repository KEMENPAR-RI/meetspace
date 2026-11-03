import { Prisma } from '@/lib/generated/prisma/client';

export type LockedRoom = { id: string; name: string; isActive: boolean };

// Read Committed so checks after the lock see the previous holder's commit (ADR 0003).
export const ROOM_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5000,
  timeout: 10000,
};

// Locks rooms rows in id order (deadlock-safe) until the tx ends; missing ids are simply absent.
export async function lockRooms(tx: Prisma.TransactionClient, roomIds: readonly string[]): Promise<LockedRoom[]> {
  const ids = [...new Set(roomIds)].sort();
  if (ids.length === 0) return [];
  // Same tx connection; lock wait gives up before Prisma's 10s tx timeout.
  await tx.$executeRaw`SET SESSION innodb_lock_wait_timeout = 5`;
  const rows = await tx.$queryRaw<{ id: string; name: string; is_active: unknown }[]>`
    SELECT id, name, is_active FROM rooms WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  return rows.map((r) => ({ id: r.id, name: r.name, isActive: Boolean(Number(r.is_active)) }));
}

// Active superadmin ids, locked so concurrent demotions serialize (E3).
export async function lockActiveSuperadmins(tx: Prisma.TransactionClient): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE role = 'SUPERADMIN' AND is_active = 1 ORDER BY id FOR UPDATE`;
  return rows.map((r) => r.id);
}

// Active rooms (locked) that would drop from >=1 to 0 active admin PJ if `removedUserIds` stopped counting (F3).
export async function findRoomsLosingLastAdmin(
  tx: Prisma.TransactionClient,
  roomIds: readonly string[],
  removedUserIds: readonly string[],
): Promise<string[]> {
  const rooms = await lockRooms(tx, roomIds);
  const active = rooms.filter((r) => r.isActive);
  if (active.length === 0) return [];
  const pjs = await tx.roomAdmin.findMany({
    where: { roomId: { in: active.map((r) => r.id) }, user: { isActive: true, role: 'ADMIN' } },
    select: { roomId: true, userId: true },
  });
  const removed = new Set(removedUserIds);
  return active
    .filter((room) => {
      const current = pjs.filter((p) => p.roomId === room.id);
      return current.length > 0 && current.every((p) => removed.has(p.userId));
    })
    .map((room) => room.name);
}

export class InvariantError extends Error {}

export function roomsLostMessage(names: string[]): string {
  return `Ruangan berikut akan tidak punya penanggung jawab: ${names.join(', ')}. Tetapkan penanggung jawab lain terlebih dahulu.`;
}
