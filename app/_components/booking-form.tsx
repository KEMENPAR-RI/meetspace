'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { initialBookingFormState, type BookingFormState } from '@/lib/booking/types';
import { BookingFields } from './booking-fields';
import { RecaptchaNotice, useRecaptchaFormAction } from './recaptcha';

type BookingAction = (state: BookingFormState, formData: FormData) => Promise<BookingFormState>;

// `action` arrives already bound to the room id (server re-checks the room).
// recaptchaSiteKey: null/undefined = reCAPTCHA disabled.
export function BookingForm({ action, recaptchaSiteKey }: { action: BookingAction; recaptchaSiteKey?: string | null }) {
  const [state, dispatch, pending] = useActionState(action, initialBookingFormState);
  const recaptcha = useRecaptchaFormAction(dispatch, recaptchaSiteKey, 'booking');

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={recaptcha.formAction} className="space-y-5">
      {recaptcha.recaptchaScript}
      {state.status !== 'idle' && state.message && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={
            state.status === 'error'
              ? 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
              : 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
          }
        >
          {state.message}
        </p>
      )}

      <BookingFields idPrefix="" values={values} errors={errors} />

      <SubmitButton pending={pending} />
      {recaptcha.enabled && <RecaptchaNotice />}
    </form>
  );
}

// useFormStatus also covers the reCAPTCHA token fetch before dispatch.
function SubmitButton({ pending }: { pending: boolean }) {
  const { pending: formPending } = useFormStatus();
  const busy = pending || formPending;
  return (
    <button
      type="submit"
      disabled={busy}
      aria-disabled={busy}
      className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
    >
      {busy ? 'Menyimpan…' : 'Simpan Booking'}
    </button>
  );
}
