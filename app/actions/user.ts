'use server';

import { refresh } from 'next/cache';

import { authorizeSuperadmin } from '@/lib/auth/access';
import type { ActionResult, FormState, ResetPasswordField, UserField } from '@/lib/auth/types';
import * as users from '@/lib/user/service';
import { parseCreateUser, parseResetPassword, parseUpdateUser, readUserValues } from '@/lib/user/validation';
import { isUuid } from '@/lib/uuid';

// Superadmin only (G3). Passwords are never echoed back in `values` (E7).

type UserFormState = FormState<UserField>;

const DENIED = 'Tidak diizinkan.';
const INVALID = 'Periksa kembali isian formulir.';

// Form fields: name, username, role (SUPERADMIN|ADMIN), password.
export async function createUser(_prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  if (!(await authorizeSuperadmin())) return { status: 'error', message: DENIED };

  const parsed = parseCreateUser(formData);
  if (!parsed.ok) return { status: 'error', message: INVALID, fieldErrors: parsed.fieldErrors, values: parsed.values };

  const result = await users.createUser(parsed.data);
  if (!result.ok) {
    return { status: 'error', message: result.message, fieldErrors: result.fieldErrors, values: readUserValues(formData) };
  }

  refresh();
  return { status: 'success', message: 'Akun berhasil dibuat.', id: result.id };
}

// Form fields: name, username, role, isActive (checkbox). `id` is bound on the client.
export async function updateUser(id: string, _prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await authorizeSuperadmin();
  if (!actor) return { status: 'error', message: DENIED };
  if (!isUuid(id)) return { status: 'error', message: 'Akun tidak ditemukan.' };

  const parsed = parseUpdateUser(formData);
  if (!parsed.ok) return { status: 'error', message: INVALID, fieldErrors: parsed.fieldErrors, values: parsed.values };

  const result = await users.updateUser(actor.id, id.toLowerCase(), parsed.data);
  if (!result.ok) {
    return { status: 'error', message: result.message, fieldErrors: result.fieldErrors, values: readUserValues(formData) };
  }

  refresh();
  return { status: 'success', message: 'Akun berhasil diperbarui.', id };
}

// Form fields: password, confirmPassword. Kills the account's sessions.
export async function resetUserPassword(
  id: string,
  _prevState: FormState<ResetPasswordField>,
  formData: FormData,
): Promise<FormState<ResetPasswordField>> {
  if (!(await authorizeSuperadmin())) return { status: 'error', message: DENIED };
  if (!isUuid(id)) return { status: 'error', message: 'Akun tidak ditemukan.' };

  const parsed = parseResetPassword(formData);
  if (!parsed.ok) return { status: 'error', message: INVALID, fieldErrors: parsed.fieldErrors };

  const result = await users.resetUserPassword(id, parsed.data.password);
  if (!result.ok) return { status: 'error', message: result.message };

  return { status: 'success', message: 'Password berhasil direset.' };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const actor = await authorizeSuperadmin();
  if (!actor) return { ok: false, message: DENIED };
  if (!isUuid(id)) return { ok: false, message: 'Akun tidak ditemukan.' };

  const result = await users.deleteUser(actor.id, id.toLowerCase());
  if (!result.ok) return { ok: false, message: result.message };

  refresh();
  return { ok: true, message: 'Akun dihapus.' };
}
