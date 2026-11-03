'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { login } from '@/app/actions/auth';
import { initialLoginState, PASSWORD_MAX, USERNAME_MAX } from '@/lib/auth/types';
import { RecaptchaNotice, useRecaptchaFormAction } from '@/app/_components/recaptcha';
import { Field, inputClass, primaryButton } from './ui';

// recaptchaSiteKey null = reCAPTCHA disabled.
export function LoginForm({ recaptchaSiteKey }: { recaptchaSiteKey: string | null }) {
  const [state, dispatch] = useActionState(login, initialLoginState);
  const recaptcha = useRecaptchaFormAction(dispatch, recaptchaSiteKey, 'login');
  const failed = state.status === 'error';
  // Keep the typed username after a failed attempt; never the password.
  const username = state.values?.username;

  return (
    <form action={recaptcha.formAction} className="space-y-5">
      {recaptcha.recaptchaScript}
      {failed && state.message && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.message}
        </p>
      )}

      <Field label="Username" id="username">
        <input
          id="username"
          name="username"
          type="text"
          required
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={USERNAME_MAX}
          autoComplete="username"
          defaultValue={username}
          aria-invalid={failed ? true : undefined}
          className={inputClass}
        />
      </Field>

      <Field label="Password" id="password">
        <input
          id="password"
          name="password"
          type="password"
          required
          maxLength={PASSWORD_MAX}
          autoComplete="current-password"
          aria-invalid={failed ? true : undefined}
          className={inputClass}
        />
      </Field>

      <SubmitButton />
      {recaptcha.enabled && <RecaptchaNotice />}
    </form>
  );
}

// useFormStatus also covers the reCAPTCHA token fetch before dispatch.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
      {pending ? 'Memproses…' : 'Masuk'}
    </button>
  );
}
