import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { prismaErrorCode } from '@/lib/prisma-errors';

import { lockRooms, ROOM_TX_OPTIONS } from './lock';
import type { RoomField } from './types';
import type { RoomInput } from './validation';

// Superadmin-only writes; callers authorize first. Invariants F2/F3/A4 live here.

export type RoomWriteResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Partial<Record<RoomField, string>> };

const DUPLICATE_NAME = 'Nama ruangan sudah dipakai.';
const NO_ADMIN = 'Ruangan aktif wajib punya minimal 1 penanggung jawab.';
const INVALID_ADMIN = 'Penanggung jawab harus akun admin yang aktif.';
const ADMIN_TAKEN = 'Admin sudah ditugaskan di ruangan lain.';
const ACTIVE_PJ = { user: { isActive: true, role: 'ADMIN' as const } };

class FieldError extends Error {
  constructor(
    readonly field: RoomField,
    message: string,
  ) {
    super(message);
  }
}

class Rejected extends Error {}

// Locks the chosen users; every id must be an active ADMIN not assigned to another room (1 admin = 1 room).
async function assertAssignableAdmins(
  tx: Prisma.TransactionClient,
  adminIds: string[],
  roomId?: string,
): Promise<void> {
  if (adminIds.length === 0) return;
  const ids = [...adminIds].sort();
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE id IN (${Prisma.join(ids)}) AND role = 'ADMIN' AND is_active = 1
    ORDER BY id FOR UPDATE`;
  if (rows.length !== ids.length) throw new FieldError('adminIds', INVALID_ADMIN);
  const taken = await tx.roomAdmin.findMany({
    where: { userId: { in: ids }, ...(roomId ? { roomId: { not: roomId } } : {}) },
    select: { user: { select: { name: true } }, room: { select: { name: true } } },
  });
  if (taken.length > 0) {
    const who = taken.map((t) => `${t.user.name} (${t.room.name})`).join(', ');
    throw new FieldError('adminIds', `${ADMIN_TAKEN} ${who}.`);
  }
}

// P2002 on room_admins.user_id = admin already assigned (race backstop); else the room name/slug.
function isAdminUniqueViolation(error: unknown): boolean {
  const meta = (error as { meta?: unknown })?.meta;
  const text = `${JSON.stringify(meta ?? '')} ${error instanceof Error ? error.message : ''}`;
  return /user_id|userId|room_admins/i.test(text);
}

async function assertNameFree(tx: Prisma.TransactionClient, name: string, exceptId?: string): Promise<void> {
  // utf8mb4_unicode_ci: case-insensitive match (A1).
  const clash = await tx.room.findFirst({
    where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new FieldError('name', DUPLICATE_NAME);
}

function toFailure(error: unknown, fallback: string): RoomWriteResult {
  if (error instanceof FieldError) return { ok: false, message: error.message, fieldErrors: { [error.field]: error.message } };
  if (error instanceof Rejected) return { ok: false, message: error.message };
  // Backstop for a concurrent insert with the same name.
  if (prismaErrorCode(error) === 'P2002') {
    if (isAdminUniqueViolation(error)) return { ok: false, message: ADMIN_TAKEN, fieldErrors: { adminIds: ADMIN_TAKEN } };
    return { ok: false, message: DUPLICATE_NAME, fieldErrors: { name: DUPLICATE_NAME } };
  }
  console.error('[room] write failed', error);
  return { ok: false, message: fallback };
}

export async function createRoom(input: RoomInput): Promise<RoomWriteResult> {
  // F2: create always needs a PJ (validation already enforces it; re-checked here).
  if (input.adminIds.length === 0) return { ok: false, message: NO_ADMIN, fieldErrors: { adminIds: NO_ADMIN } };
  try {
    const id = await prisma.$transaction(async (tx) => {
      await assertAssignableAdmins(tx, input.adminIds);
      await assertNameFree(tx, input.name);
      const room = await tx.room.create({
        data: {
          name: input.name,
          building: input.building,
          floor: input.floor,
          capacity: input.capacity,
          facilities: input.facilities,
          isActive: input.isActive,
          admins: { create: input.adminIds.map((userId) => ({ userId })) },
        },
        select: { id: true },
      });
      return room.id;
    }, ROOM_TX_OPTIONS);
    return { ok: true, id };
  } catch (error) {
    return toFailure(error, 'Ruangan gagal disimpan. Silakan coba lagi.');
  }
}

// URL/QR use the room id, so renames never break them. PJ rows of inactive accounts are kept for reactivation.
export async function updateRoom(id: string, input: RoomInput): Promise<RoomWriteResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const [room] = await lockRooms(tx, [id]);
      if (!room) throw new Rejected('Ruangan tidak ditemukan.');
      await assertAssignableAdmins(tx, input.adminIds, id);
      await assertNameFree(tx, input.name, id);

      const currentPj = await tx.roomAdmin.count({ where: { roomId: id, ...ACTIVE_PJ } });
      // F3 + F4: a room left at 0 PJ only stays allowed if it was already active with 0 PJ (migrated default).
      if (input.isActive && input.adminIds.length === 0 && (currentPj > 0 || !room.isActive)) {
        throw new FieldError('adminIds', NO_ADMIN);
      }

      await tx.room.update({
        where: { id },
        data: {
          name: input.name,
          building: input.building,
          floor: input.floor,
          capacity: input.capacity,
          facilities: input.facilities,
          isActive: input.isActive,
        },
        select: { id: true },
      });
      await tx.roomAdmin.deleteMany({ where: { roomId: id, userId: { notIn: input.adminIds }, ...ACTIVE_PJ } });
      if (input.adminIds.length > 0) {
        await tx.roomAdmin.createMany({
          data: input.adminIds.map((userId) => ({ roomId: id, userId })),
          skipDuplicates: true,
        });
      }
    }, ROOM_TX_OPTIONS);
    return { ok: true, id };
  } catch (error) {
    return toFailure(error, 'Ruangan gagal diperbarui. Silakan coba lagi.');
  }
}

export async function setRoomActive(id: string, active: boolean): Promise<RoomWriteResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const [room] = await lockRooms(tx, [id]);
      if (!room) throw new Rejected('Ruangan tidak ditemukan.');
      if (room.isActive === active) return;
      if (active && (await tx.roomAdmin.count({ where: { roomId: id, ...ACTIVE_PJ } })) === 0) {
        throw new Rejected(`${NO_ADMIN} Tetapkan penanggung jawab untuk "${room.name}" terlebih dahulu.`);
      }
      await tx.room.update({ where: { id }, data: { isActive: active }, select: { id: true } });
    }, ROOM_TX_OPTIONS);
    return { ok: true, id };
  } catch (error) {
    return toFailure(error, 'Status ruangan gagal diubah. Silakan coba lagi.');
  }
}

const HAS_BOOKINGS = 'Ruangan yang sudah punya booking tidak bisa dihapus. Nonaktifkan saja.';

// A4: only rooms without bookings; the RESTRICT FK is the backstop.
export async function deleteRoom(id: string): Promise<RoomWriteResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const [room] = await lockRooms(tx, [id]);
      if (!room) throw new Rejected('Ruangan tidak ditemukan.');
      if ((await tx.booking.count({ where: { roomId: id } })) > 0) throw new Rejected(HAS_BOOKINGS);
      await tx.room.delete({ where: { id }, select: { id: true } });
    }, ROOM_TX_OPTIONS);
    return { ok: true, id };
  } catch (error) {
    if (prismaErrorCode(error) === 'P2003') return { ok: false, message: HAS_BOOKINGS };
    return toFailure(error, 'Ruangan gagal dihapus. Silakan coba lagi.');
  }
}
