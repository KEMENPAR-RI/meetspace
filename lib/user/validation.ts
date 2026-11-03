import { z } from 'zod';

import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USER_NAME_MAX,
  USER_ROLES,
  USERNAME_MAX,
  USERNAME_MIN,
  type PasswordField,
  type ResetPasswordField,
  type UserField,
  type UserRoleName,
} from '@/lib/auth/types';

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

type Issues = z.core.$ZodIssue[];

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN, `Username minimal ${USERNAME_MIN} karakter.`)
  .max(USERNAME_MAX, `Username maksimal ${USERNAME_MAX} karakter.`)
  .regex(USERNAME_PATTERN, 'Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip.');

export const userNameSchema = z
  .string()
  .trim()
  .min(1, 'Nama wajib diisi.')
  .max(USER_NAME_MAX, `Nama maksimal ${USER_NAME_MAX} karakter.`)
  .refine((v) => !CONTROL_CHARS.test(v), 'Nama mengandung karakter yang tidak valid.');

// Not trimmed: spaces are part of the password.
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password minimal ${PASSWORD_MIN} karakter.`)
  .max(PASSWORD_MAX, `Password maksimal ${PASSWORD_MAX} karakter.`);

const roleSchema = z.enum(USER_ROLES, 'Pilih role.');

// Checkbox: present ('on' / '1' / 'true') = true.
export function readCheckbox(formData: FormData, key: string): boolean {
  const raw = formData.get(key);
  return raw === 'on' || raw === '1' || raw === 'true';
}

function readString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : '';
}

function toFieldErrors<F extends string>(issues: Issues, fields: readonly F[]): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && (fields as readonly string[]).includes(field) && !errors[field as F]) {
      errors[field as F] = issue.message;
    }
  }
  return errors;
}

type Parsed<T, F extends string> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Partial<Record<F, string>>; values: Partial<Record<F, string>> };

export type CreateUserInput = { name: string; username: string; role: UserRoleName; password: string };
export type UpdateUserInput = { name: string; username: string; role: UserRoleName; isActive: boolean };

const USER_FIELDS: readonly UserField[] = ['name', 'username', 'role', 'isActive', 'password'];

// Values echoed back to the form; never the password (E7).
export function readUserValues(formData: FormData): Partial<Record<UserField, string>> {
  return {
    name: readString(formData, 'name'),
    username: readString(formData, 'username'),
    role: readString(formData, 'role'),
    isActive: readCheckbox(formData, 'isActive') ? '1' : '',
  };
}

const createUserSchema = z.object({
  name: userNameSchema,
  username: usernameSchema,
  role: roleSchema,
  password: passwordSchema,
});

export function parseCreateUser(formData: FormData): Parsed<CreateUserInput, UserField> {
  const values = readUserValues(formData);
  const result = createUserSchema.safeParse({ ...values, password: readString(formData, 'password') });
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, fieldErrors: toFieldErrors(result.error.issues, USER_FIELDS), values };
}

const updateUserSchema = z.object({
  name: userNameSchema,
  username: usernameSchema,
  role: roleSchema,
  isActive: z.boolean(),
});

export function parseUpdateUser(formData: FormData): Parsed<UpdateUserInput, UserField> {
  const values = readUserValues(formData);
  const result = updateUserSchema.safeParse({ ...values, isActive: readCheckbox(formData, 'isActive') });
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, fieldErrors: toFieldErrors(result.error.issues, USER_FIELDS), values };
}

const RESET_FIELDS: readonly ResetPasswordField[] = ['password', 'confirmPassword'];

const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak sama.',
  });

export function parseResetPassword(formData: FormData): Parsed<{ password: string }, ResetPasswordField> {
  const result = resetSchema.safeParse({
    password: readString(formData, 'password'),
    confirmPassword: readString(formData, 'confirmPassword'),
  });
  if (result.success) return { ok: true, data: { password: result.data.password } };
  return { ok: false, fieldErrors: toFieldErrors(result.error.issues, RESET_FIELDS), values: {} };
}

const PASSWORD_FIELDS: readonly PasswordField[] = ['currentPassword', 'newPassword', 'confirmPassword'];

const changeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password lama wajib diisi.').max(PASSWORD_MAX, 'Password lama salah.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak sama.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Password baru harus berbeda dari password lama.',
  });

export function parseChangePassword(
  formData: FormData,
): Parsed<{ currentPassword: string; newPassword: string }, PasswordField> {
  const result = changeSchema.safeParse({
    currentPassword: readString(formData, 'currentPassword'),
    newPassword: readString(formData, 'newPassword'),
    confirmPassword: readString(formData, 'confirmPassword'),
  });
  if (result.success) {
    return { ok: true, data: { currentPassword: result.data.currentPassword, newPassword: result.data.newPassword } };
  }
  return { ok: false, fieldErrors: toFieldErrors(result.error.issues, PASSWORD_FIELDS), values: {} };
}
