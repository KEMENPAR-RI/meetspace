'use server';

import { refresh } from 'next/cache';

import { authorizeSuperadmin } from '@/lib/auth/access';
import type { ActionResult, FormState } from '@/lib/auth/types';
import * as rooms from '@/lib/room/service';
import type { RoomField } from '@/lib/room/types';
import { parseRoomInput, readRoomValues } from '@/lib/room/validation';
import { isUuid } from '@/lib/uuid';

// Superadmin only (G3). Form fields: name, building, floor, capacity, facilities, isActive (checkbox), adminIds[].

type RoomFormState = FormState<RoomField>;

const DENIED = 'Tidak diizinkan.';

export async function createRoom(_prevState: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const values = readRoomValues(formData);
  if (!(await authorizeSuperadmin())) return { status: 'error', message: DENIED, values };

  const parsed = parseRoomInput(formData, { requireAdmin: true });
  if (!parsed.ok) {
    return { status: 'error', message: 'Periksa kembali isian formulir.', fieldErrors: parsed.fieldErrors, values };
  }

  const result = await rooms.createRoom(parsed.data);
  if (!result.ok) return { status: 'error', message: result.message, fieldErrors: result.fieldErrors, values };

  refresh();
  return { status: 'success', message: 'Ruangan berhasil dibuat.', id: result.id };
}

// `id` is bound on the client: treat it as unknown at runtime.
export async function updateRoom(id: string, _prevState: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const values = readRoomValues(formData);
  if (!(await authorizeSuperadmin())) return { status: 'error', message: DENIED, values };
  if (!isUuid(id)) return { status: 'error', message: 'Ruangan tidak ditemukan.', values };

  const parsed = parseRoomInput(formData, { requireAdmin: false });
  if (!parsed.ok) {
    return { status: 'error', message: 'Periksa kembali isian formulir.', fieldErrors: parsed.fieldErrors, values };
  }

  const result = await rooms.updateRoom(id, parsed.data);
  if (!result.ok) return { status: 'error', message: result.message, fieldErrors: result.fieldErrors, values };

  refresh();
  return { status: 'success', message: 'Ruangan berhasil diperbarui.', id };
}

export async function setRoomActive(id: string, active: boolean): Promise<ActionResult> {
  if (!(await authorizeSuperadmin())) return { ok: false, message: DENIED };
  if (!isUuid(id) || typeof active !== 'boolean') return { ok: false, message: 'Permintaan tidak valid.' };

  const result = await rooms.setRoomActive(id, active);
  if (!result.ok) return { ok: false, message: result.message };

  refresh();
  return { ok: true, message: active ? 'Ruangan diaktifkan.' : 'Ruangan dinonaktifkan.' };
}

// A4: rejected when the room has bookings.
export async function deleteRoom(id: string): Promise<ActionResult> {
  if (!(await authorizeSuperadmin())) return { ok: false, message: DENIED };
  if (!isUuid(id)) return { ok: false, message: 'Ruangan tidak ditemukan.' };

  const result = await rooms.deleteRoom(id);
  if (!result.ok) return { ok: false, message: result.message };

  refresh();
  return { ok: true, message: 'Ruangan dihapus.' };
}
