// Shared auth contract (client-safe, no server imports); 'use server' files may export only async functions.

export const USER_ROLES = ['SUPERADMIN', 'ADMIN'] as const;
export type UserRoleName = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRoleName, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
};

// Session user loaded per request (lib/auth/access.ts); roomIds = assigned rooms (admin only).
export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: UserRoleName;
  roomIds: string[];
};

export type RoomScope = { all: true } | { all: false; roomIds: string[] };

// Shared by server checks and input `maxLength`/`minLength`.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 50;
export const USER_NAME_MAX = 100;

export type LoginField = 'username' | 'password';

// `values` never carries the password.
export type LoginState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  values?: { username?: string };
};

export const initialLoginState: LoginState = { status: 'idle' };

// Generic form state for dashboard forms; `values` never carries passwords (E7). `id` = created record.
export type FormState<F extends string = string> = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<F, string>>;
  values?: Partial<Record<F, string | string[]>>;
  id?: string;
};

export const initialFormState: FormState = { status: 'idle' };

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

export type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';
export type UserField = 'name' | 'username' | 'role' | 'isActive' | 'password';
export type ResetPasswordField = 'password' | 'confirmPassword';
