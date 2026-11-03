import { hashPassword, PasswordHasherBusyError, verifyPassword } from '@/lib/auth/password';
import { deleteUserSessions } from '@/lib/auth/session-store';
import type { UserField } from '@/lib/auth/types';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { prismaErrorCode } from '@/lib/prisma-errors';
import { findRoomsLosingLastAdmin, lockActiveSuperadmins, ROOM_TX_OPTIONS, roomsLostMessage } from '@/lib/room/lock';

import type { CreateUserInput, UpdateUserInput } from './validation';

// Superadmin-only writes (except changeOwnPassword); callers authorize first. Invariants E3/F3 live here.

export type UserWriteResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Partial<Record<UserField, string>> };

const DUPLICATE_USERNAME = 'Username sudah dipakai.';
const LAST_SUPERADMIN = 'Minimal harus ada 1 superadmin aktif.';
const NOT_FOUND = 'Akun tidak ditemukan.';

class Rejected extends Error {}

function toFailure(error: unknown, fallback: string): UserWriteResult {
  if (error instanceof Rejected) return { ok: false, message: error.message };
  if (error instanceof PasswordHasherBusyError) return { ok: false, message: 'Server sedang sibuk. Coba lagi sebentar.' };
  if (prismaErrorCode(error) === 'P2002') {
    return { ok: false, message: DUPLICATE_USERNAME, fieldErrors: { username: DUPLICATE_USERNAME } };
  }
  if (prismaErrorCode(error) === 'P2025') return { ok: false, message: NOT_FOUND };
  console.error('[user] write failed', error);
  return { ok: false, message: fallback };
}

type Target = { id: string; role: 'SUPERADMIN' | 'ADMIN'; isActive: boolean };

// Locks the active-superadmin set first (fixed order), then the target row.
async function lockTarget(tx: Prisma.TransactionClient, id: string): Promise<{ target: Target; superadmins: string[] }> {
  const superadmins = await lockActiveSuperadmins(tx);
  const rows = await tx.$queryRaw<{ id: string; role: 'SUPERADMIN' | 'ADMIN'; is_active: unknown }[]>`
    SELECT id, role, is_active FROM users WHERE id = ${id} FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new Rejected(NOT_FOUND);
  return { target: { id: row.id, role: row.role, isActive: Boolean(Number(row.is_active)) }, superadmins };
}

// E3: the target must not be the last active superadmin.
function assertKeepsSuperadmin(target: Target, superadmins: string[]): void {
  if (target.role === 'SUPERADMIN' && target.isActive && superadmins.filter((s) => s !== target.id).length === 0) {
    throw new Rejected(LAST_SUPERADMIN);
  }
}

// F3: an active admin leaving PJ duty must not empty any active room.
async function assertRoomsKeepAdmin(tx: Prisma.TransactionClient, target: Target): Promise<void> {
  if (target.role !== 'ADMIN' || !target.isActive) return;
  const rooms = await tx.roomAdmin.findMany({ where: { userId: target.id }, select: { roomId: true } });
  const lost = await findRoomsLosingLastAdmin(
    tx,
    rooms.map((r) => r.roomId),
    [target.id],
  );
  if (lost.length > 0) throw new Rejected(roomsLostMessage(lost));
}

export async function createUser(input: CreateUserInput): Promise<UserWriteResult> {
  try {
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: { name: input.name, username: input.username, role: input.role, passwordHash },
      select: { id: true },
    });
    return { ok: true, id: user.id };
  } catch (error) {
    return toFailure(error, 'Akun gagal disimpan. Silakan coba lagi.');
  }
}

export async function updateUser(actorId: string, id: string, input: UpdateUserInput): Promise<UserWriteResult> {
  if (id === actorId && !input.isActive) return { ok: false, message: 'Tidak bisa menonaktifkan akun sendiri.' };
  try {
    await prisma.$transaction(async (tx) => {
      const { target, superadmins } = await lockTarget(tx, id);
      const roleChanged = target.role !== input.role;
      const deactivated = target.isActive && !input.isActive;

      if (roleChanged || deactivated) assertKeepsSuperadmin(target, superadmins);
      if ((roleChanged && input.role === 'SUPERADMIN') || deactivated) await assertRoomsKeepAdmin(tx, target);

      await tx.user.update({
        where: { id },
        data: {
          name: input.name,
          username: input.username,
          role: input.role,
          isActive: input.isActive,
        },
        select: { id: true },
      });
      // E6: role change / status change kills every existing session.
      if (roleChanged || target.isActive !== input.isActive) await deleteUserSessions(id, tx);
      // Superadmins are never PJ.
      if (roleChanged && input.role === 'SUPERADMIN') await tx.roomAdmin.deleteMany({ where: { userId: id } });
    }, ROOM_TX_OPTIONS);
    return { ok: true, id };
  } catch (error) {
    return toFailure(error, 'Akun gagal diperbarui. Silakan coba lagi.');
  }
}

export async function resetUserPassword(id: string, password: string): Promise<UserWriteResult> {
  try {
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash }, select: { id: true } });
      await deleteUserSessions(id, tx);
    });
    return { ok: true, id };
  } catch (error) {
    return toFailure(error, 'Password gagal direset. Silakan coba lagi.');
  }
}

export async function deleteUser(actorId: string, id: string): Promise<UserWriteResult> {
  if (id === actorId) return { ok: false, message: 'Tidak bisa menghapus akun sendiri.' };
  try {
    await prisma.$transaction(async (tx) => {
      const { target, superadmins } = await lockTarget(tx, id);
      assertKeepsSuperadmin(target, superadmins);
      await assertRoomsKeepAdmin(tx, target);
      // room_admins rows cascade.
      await tx.user.delete({ where: { id }, select: { id: true } });
    }, ROOM_TX_OPTIONS);
    return { ok: true, id };
  } catch (error) {
    return toFailure(error, 'Akun gagal dihapus. Silakan coba lagi.');
  }
}

export type ChangeOwnPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-password' | 'gone' | 'error' };

// E5: verify the current password, store the new hash, revoke all sessions (caller issues a new one).
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangeOwnPasswordResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, isActive: true },
    });
    if (!user || !user.isActive) return { ok: false, reason: 'gone' };
    if (!(await verifyPassword(currentPassword, user.passwordHash))) return { ok: false, reason: 'wrong-password' };

    const passwordHash = await hashPassword(newPassword);
    // Guard on the old hash: a concurrent reset wins.
    const count = await prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, isActive: true, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (count === 1) await deleteUserSessions(userId, tx);
      return count;
    });
    return count === 1 ? { ok: true } : { ok: false, reason: 'gone' };
  } catch (error) {
    console.error('[user] changeOwnPassword failed', error);
    return { ok: false, reason: 'error' };
  }
}
