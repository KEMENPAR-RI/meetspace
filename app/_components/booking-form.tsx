'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CalendarPlus, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { initialBookingFormState, type BookingFormState } from '@/lib/booking/types';
import { BookingFields } from './booking-fields';
import { RecaptchaNotice, useRecaptchaFormAction } from './recaptcha';

type BookingAction = (state: BookingFormState, formData: FormData) => Promise<BookingFormState>;

// `action` arrives already bound to the room id (server re-checks the room).
// recaptchaSiteKey null/undefined = reCAPTCHA not configured: the server rejects bookings, so submit is disabled.
export function BookingForm({ action, recaptchaSiteKey }: { action: BookingAction; recaptchaSiteKey?: string | null }) {
  const [state, dispatch, pending] = useActionState(action, initialBookingFormState);
  const recaptcha = useRecaptchaFormAction(dispatch, recaptchaSiteKey, 'booking');

  const offline = !recaptcha.enabled;
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={recaptcha.formAction} className="space-y-5">
      {recaptcha.recaptchaScript}
      {offline && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span className="min-w-0">
            <span className="font-semibold">Booking online nonaktif, hubungi admin.</span> Form belum dapat dikirim.
          </span>
        </p>
      )}
      {state.status !== 'idle' && state.message && (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={
            state.status === 'error'
              ? 'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
              : 'flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
          }
        >
          {state.status === 'error' ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="min-w-0">{state.message}</span>
        </p>
      )}

      <BookingFields idPrefix="" values={values} errors={errors} />

      <SubmitButton pending={pending} disabled={offline} />
      {recaptcha.enabled && <RecaptchaNotice />}
    </form>
  );
}

// useFormStatus also covers the reCAPTCHA token fetch before dispatch.
function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  const { pending: formPending } = useFormStatus();
  const busy = pending || formPending;
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      aria-disabled={busy || disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
    >
      {busy ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <CalendarPlus className="size-4" />}
      {busy ? 'Menyimpan…' : 'Simpan Booking'}
    </button>
  );
}
