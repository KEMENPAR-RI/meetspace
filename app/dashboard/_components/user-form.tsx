'use client';

import { useActionState } from 'react';
import {
  initialFormState,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USER_NAME_MAX,
  USERNAME_MAX,
  USERNAME_MIN,
  type UserRoleName,
} from '@/lib/auth/types';
import { Field, FormMessage, fieldAria, inputClass, primaryButton, readValue, type UiFormState } from './ui';

export type UserFormInitial = { name: string; username: string; role: UserRoleName; isActive: boolean };

type Props = {
  action: (state: UiFormState, formData: FormData) => Promise<UiFormState>;
  mode: 'create' | 'edit';
  initial?: UserFormInitial;
};

export function UserForm({ action, mode, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const submitted = state.status === 'error' ? state.values : undefined;
  const value = (name: string, fallback?: string) => (submitted ? (readValue(submitted, name) ?? '') : (fallback ?? ''));
  const role = (submitted ? readValue(submitted, 'role') : initial?.role) ?? 'ADMIN';
  const isActive = submitted ? readValue(submitted, 'isActive') === '1' : (initial?.isActive ?? true);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <Field label="Nama" id="user-name" error={errors.name}>
        <input
          name="name"
          type="text"
          required
          maxLength={USER_NAME_MAX}
          autoComplete="off"
          defaultValue={value('name', initial?.name)}
          className={inputClass}
          {...fieldAria('user-name', errors.name)}
        />
      </Field>

      <Field
        label="Username"
        id="user-username"
        error={errors.username}
        hint="3–50 karakter: huruf kecil, angka, titik, garis bawah, atau strip."
      >
        <input
          name="username"
          type="text"
          required
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          pattern="[a-zA-Z0-9._\-]{3,50}"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          defaultValue={value('username', initial?.username)}
          className={`${inputClass} font-mono`}
          {...fieldAria('user-username', errors.username, true)}
        />
      </Field>

      <fieldset aria-describedby={errors.role ? 'user-role-error' : undefined}>
        <legend className="mb-1.5 text-sm font-medium text-zinc-800">Role</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              { value: 'ADMIN', label: 'Admin', hint: 'Kelola booking & daftar hadir ruangan yang ditugaskan.' },
              { value: 'SUPERADMIN', label: 'Superadmin', hint: 'Akses penuh, termasuk ruangan & akun.' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 has-[:checked]:border-primary has-[:checked]:bg-primary/[0.03] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                required
                defaultChecked={role === opt.value}
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="text-sm">
                <span className="block font-medium text-zinc-800">{opt.label}</span>
                <span className="block text-xs text-zinc-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.role && (
          <p id="user-role-error" className="mt-1.5 text-sm text-red-600">
            {errors.role}
          </p>
        )}
      </fieldset>

      {mode === 'create' ? (
        <Field label="Password awal" id="user-password" error={errors.password} hint={`Minimal ${PASSWORD_MIN} karakter.`}>
          <input
            name="password"
            type="password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            className={inputClass}
            {...fieldAria('user-password', errors.password, true)}
          />
        </Field>
      ) : (
        <div className="space-y-1">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-zinc-800">
            <input
              type="checkbox"
              name="isActive"
              value="1"
              defaultChecked={isActive}
              className="size-4 rounded border-zinc-300 accent-primary"
            />
            Akun aktif
          </label>
          <p className="pl-6.5 text-xs text-zinc-500">Akun nonaktif tidak bisa login; sesi yang berjalan langsung berakhir.</p>
          {errors.isActive && <p className="text-sm text-red-600">{errors.isActive}</p>}
        </div>
      )}

      <div className="flex justify-end border-t border-zinc-100 pt-5">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? 'Menyimpan…' : mode === 'create' ? 'Buat Akun' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  );
}
