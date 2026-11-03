'use client';

import { useActionState } from 'react';
import { initialFormState, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/auth/types';
import { Field, FormMessage, fieldAria, inputClass, primaryButton, type UiFormState } from './ui';

type Props = {
  action: (state: UiFormState, formData: FormData) => Promise<UiFormState>;
  // own: change own password (needs current); reset: superadmin resets another account.
  mode: 'own' | 'reset';
};

// Password inputs are never refilled from state (E7).
export function PasswordForm({ action, mode }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const newName = mode === 'own' ? 'newPassword' : 'password';

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      {mode === 'own' && (
        <Field label="Password saat ini" id="pw-current" error={errors.currentPassword}>
          <input
            name="currentPassword"
            type="password"
            required
            maxLength={PASSWORD_MAX}
            autoComplete="current-password"
            className={inputClass}
            {...fieldAria('pw-current', errors.currentPassword)}
          />
        </Field>
      )}

      <Field label="Password baru" id="pw-new" error={errors[newName]} hint={`Minimal ${PASSWORD_MIN} karakter.`}>
        <input
          name={newName}
          type="password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          className={inputClass}
          {...fieldAria('pw-new', errors[newName], true)}
        />
      </Field>

      <Field label="Ulangi password baru" id="pw-confirm" error={errors.confirmPassword}>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          className={inputClass}
          {...fieldAria('pw-confirm', errors.confirmPassword)}
        />
      </Field>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? 'Menyimpan…' : mode === 'own' ? 'Ganti Password' : 'Reset Password'}
        </button>
      </div>
    </form>
  );
}
