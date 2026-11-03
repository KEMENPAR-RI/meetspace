'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signatureFont } from '@/app/fonts/signature';
import {
  ATTENDANCE_LIMITS,
  ATTENDEE_ROLES,
  ATTENDEE_ROLE_LABELS,
  GENDER_LABELS,
  GENDERS,
  initialAttendanceFormState,
  type AttendanceField,
  type AttendanceFormState,
} from '@/lib/booking/types';
import { RecaptchaNotice, useRecaptchaFormAction } from './recaptcha';

// Same look as booking-fields; text-base on mobile stops iOS focus-zoom.
const inputClass =
  'block w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-xs sm:text-sm ' +
  'placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ' +
  'aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/30';

type AttendanceAction = (state: AttendanceFormState, formData: FormData) => Promise<AttendanceFormState>;

export function AttendanceForm({
  action,
  variant,
  recaptchaSiteKey,
}: {
  action: AttendanceAction;
  variant: 'public' | 'internal';
  // Public variant only; null/undefined = reCAPTCHA disabled.
  recaptchaSiteKey?: string | null;
}) {
  const [state, dispatch, pending] = useActionState(action, initialAttendanceFormState);
  const recaptcha = useRecaptchaFormAction(dispatch, variant === 'public' ? recaptchaSiteKey : null, 'attendance');

  // Signature preview mirrors the typed name; resynced whenever a new state arrives.
  const [preview, setPreview] = useState('');
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    // Public success keeps the name for the confirmation card.
    if (!(variant === 'public' && state.status === 'success')) setPreview(state.values?.attendeeName ?? '');
  }

  if (variant === 'public' && state.status === 'success') {
    return <SuccessCard name={preview} />;
  }

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const genderError = errors.gender;

  const errorId = (name: AttendanceField) => (errors[name] ? `${name}-error` : undefined);
  const fieldProps = (name: AttendanceField) => ({
    id: name,
    name,
    defaultValue: values[name],
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errorId(name),
  });

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

      <Field label="Nama lengkap" id="attendeeName" error={errors.attendeeName}>
        <input
          type="text"
          required
          minLength={ATTENDANCE_LIMITS.attendeeNameMin}
          maxLength={ATTENDANCE_LIMITS.attendeeName}
          autoComplete="name"
          className={inputClass}
          {...fieldProps('attendeeName')}
          onChange={(e) => setPreview(e.currentTarget.value)}
          aria-describedby={['attendeeName-hint', errorId('attendeeName')].filter(Boolean).join(' ')}
        />
        <p id="attendeeName-hint" className="text-xs text-zinc-500">
          Nama Anda sekaligus menjadi tanda tangan.
        </p>
      </Field>

      <Field label="Satker/Instansi" id="satker" error={errors.satker}>
        <input
          type="text"
          required
          maxLength={ATTENDANCE_LIMITS.satker}
          autoComplete="organization"
          className={inputClass}
          {...fieldProps('satker')}
        />
      </Field>

      <fieldset aria-describedby={genderError ? 'gender-error' : undefined} className="min-w-0 space-y-1.5">
        <legend className="text-sm font-medium text-zinc-800">Jenis Kelamin</legend>
        <div className="grid grid-cols-2 gap-2">
          {GENDERS.map((g) => (
            <label
              key={g}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary sm:py-2 sm:text-sm"
            >
              <input
                type="radio"
                name="gender"
                value={g}
                required
                defaultChecked={values.gender === g}
                className="size-4 accent-primary"
              />
              {GENDER_LABELS[g]}
            </label>
          ))}
        </div>
        {genderError && (
          <p id="gender-error" className="text-sm text-red-600">
            {genderError}
          </p>
        )}
      </fieldset>

      <Field label="Sebagai" id="role" error={errors.role}>
        <select required className={inputClass} {...fieldProps('role')} defaultValue={values.role ?? ''}>
          <option value="" disabled>
            Pilih…
          </option>
          {ATTENDEE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ATTENDEE_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="No HP" optional id="phone" error={errors.phone}>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={ATTENDANCE_LIMITS.phoneRaw}
          placeholder="0812xxxxxxxx"
          className={`${inputClass} tabular-nums`}
          {...fieldProps('phone')}
        />
      </Field>

      <SignaturePreview name={preview} />

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
      className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5 sm:text-sm motion-safe:transition-colors"
    >
      {busy ? 'Menyimpan…' : 'Isi Daftar Hadir'}
    </button>
  );
}

// Decorative: the name input (and its hint) already conveys the value.
function SignaturePreview({ name }: { name: string }) {
  const trimmed = name.trim();
  return (
    <div aria-hidden="true" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 pt-3 pb-4">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Tanda tangan</p>
      <p className="mt-1 flex min-h-14 items-end border-b border-zinc-400 pb-1">
        {trimmed ? (
          <span className={`${signatureFont.className} block truncate text-4xl leading-tight text-primary`}>
            {trimmed}
          </span>
        ) : (
          <span className="pb-1 text-sm text-zinc-400">Muncul otomatis dari nama</span>
        )}
      </p>
    </div>
  );
}

function SuccessCard({ name }: { name: string }) {
  const trimmed = name.trim();
  return (
    <div role="status" className="py-4 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-7">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <p className="mt-4 text-lg font-semibold text-primary">Kehadiran berhasil dicatat</p>
      {trimmed && (
        <p className={`${signatureFont.className} mt-3 break-words text-4xl leading-tight text-primary`}>
          {trimmed}
        </p>
      )}
      <p className="mt-3 text-sm text-pretty text-zinc-600">Terima kasih. Halaman ini boleh ditutup.</p>
    </div>
  );
}

function Field({
  label,
  id,
  optional,
  error,
  children,
}: {
  label: string;
  id: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
        {optional && <span className="ml-1 font-normal text-zinc-500">(opsional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
