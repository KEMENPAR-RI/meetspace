'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { updateAppearance } from '@/app/actions/settings';
import { initialFormState } from '@/lib/auth/types';
import {
  APPEARANCE_LIMITS,
  LOGO_MIMES,
  PRIMARY_COLOR_PRESETS,
  PRIMARY_COLORS,
  type PrimaryColor,
} from '@/lib/settings/types';
import { Field, FormMessage, cardClass, fieldAria, inputClass, primaryButton, readValue, secondaryButton } from './ui';

type Initial = {
  appName: string;
  institutionName: string | null;
  primaryColor: PrimaryColor;
  logoUrl: string | null;
};

const MAX_KB = APPEARANCE_LIMITS.logoMaxBytes / 1024;

export function AppearanceForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState(updateAppearance, initialFormState);
  const errors = state.fieldErrors ?? {};
  const submitted = state.status === 'error' ? state.values : undefined;
  const text = (name: 'appName' | 'institutionName', fallback: string | null) =>
    submitted ? (readValue(submitted, name) ?? '') : (fallback ?? '');
  const pickedColor = (submitted ? readValue(submitted, 'primaryColor') : undefined) ?? initial.primaryColor;

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const logoError = fileError ?? errors.logo;
  const shownLogo = preview ?? (removeLogo ? null : initial.logoUrl);

  // Revoke the previous preview blob.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Client check mirrors the server (type + size); the server re-validates content.
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    setFileError(null);
    if (!file) return setPreview(null);
    if (!(LOGO_MIMES as readonly string[]).includes(file.type)) {
      e.currentTarget.value = '';
      setPreview(null);
      return setFileError('Format logo harus PNG, JPG, atau WebP.');
    }
    if (file.size > APPEARANCE_LIMITS.logoMaxBytes) {
      e.currentTarget.value = '';
      setPreview(null);
      return setFileError(`Ukuran logo maksimal ${MAX_KB} KB.`);
    }
    setRemoveLogo(false);
    setPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    if (fileRef.current) fileRef.current.value = '';
    setPreview(null);
    setFileError(null);
    setRemoveLogo(true);
  };

  return (
    <form action={formAction} className={`${cardClass} space-y-5`} aria-labelledby="sec-appearance">
      <div>
        <h2 id="sec-appearance" className="text-base font-semibold text-primary">Tampilan</h2>
        <p className="mt-1 text-sm text-zinc-600">Nama, logo, dan warna utama di halaman publik dan dashboard.</p>
      </div>

      <FormMessage state={state} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
        <Field label="Nama aplikasi" id="ap-appName" error={errors.appName}>
          <input
            name="appName"
            type="text"
            required
            maxLength={APPEARANCE_LIMITS.appName}
            defaultValue={text('appName', initial.appName)}
            className={inputClass}
            {...fieldAria('ap-appName', errors.appName)}
          />
        </Field>
        <Field label="Nama instansi" id="ap-institutionName" error={errors.institutionName} optional>
          <input
            name="institutionName"
            type="text"
            maxLength={APPEARANCE_LIMITS.institutionName}
            defaultValue={text('institutionName', initial.institutionName)}
            className={inputClass}
            {...fieldAria('ap-institutionName', errors.institutionName)}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ap-logo" className="block text-sm font-medium text-zinc-800">
          Logo <span className="font-normal text-zinc-500">(opsional)</span>
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            {shownLogo ? (
              // Blob preview or versioned /api/logo URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt="Pratinjau logo" className="size-full object-contain p-1" />
            ) : (
              <span className="px-2 text-center text-xs text-zinc-400">Logo bawaan</span>
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={fileRef}
              id="ap-logo"
              name="logo"
              type="file"
              accept={LOGO_MIMES.join(',')}
              onChange={onPick}
              aria-invalid={logoError ? true : undefined}
              aria-describedby={['ap-logo-hint', logoError ? 'ap-logo-error' : ''].filter(Boolean).join(' ')}
              className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border file:border-primary/30 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/5"
            />
            <p id="ap-logo-hint" className="text-xs text-zinc-500">
              PNG, JPG, atau WebP, maksimal {MAX_KB} KB. Disarankan persegi.
            </p>
            {(initial.logoUrl || preview) && !removeLogo && (
              <button type="button" onClick={clearLogo} className={secondaryButton}>
                Hapus logo
              </button>
            )}
            {removeLogo && (
              <p role="status" className="text-xs text-amber-800">
                Logo akan dihapus saat disimpan; logo bawaan dipakai kembali.{' '}
                <button type="button" onClick={() => setRemoveLogo(false)} className="font-semibold underline">
                  Batal
                </button>
              </p>
            )}
            {removeLogo && <input type="hidden" name="removeLogo" value="1" />}
          </div>
        </div>
        {logoError && (
          <p id="ap-logo-error" className="text-sm text-red-600">
            {logoError}
          </p>
        )}
      </div>

      <fieldset aria-describedby={errors.primaryColor ? 'ap-color-error' : undefined}>
        <legend className="mb-1.5 text-sm font-medium text-zinc-800">Warna utama</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIMARY_COLORS.map((key) => {
            const preset = PRIMARY_COLOR_PRESETS[key];
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-zinc-200 p-2.5 text-sm hover:bg-zinc-50 has-[:checked]:border-zinc-900 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-zinc-900"
              >
                <input
                  type="radio"
                  name="primaryColor"
                  value={key}
                  required
                  defaultChecked={pickedColor === key}
                  className="sr-only"
                />
                <span aria-hidden="true" className="flex size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                  <span className="w-2/3" style={{ backgroundColor: preset.primary }} />
                  <span className="w-1/3" style={{ backgroundColor: preset.secondary }} />
                </span>
                <span className="font-medium text-zinc-800">{preset.label}</span>
              </label>
            );
          })}
        </div>
        {errors.primaryColor && (
          <p id="ap-color-error" className="mt-1.5 text-sm text-red-600">
            {errors.primaryColor}
          </p>
        )}
      </fieldset>

      <div className="flex justify-end border-t border-zinc-100 pt-5">
        <button type="submit" disabled={pending || Boolean(fileError)} className={primaryButton}>
          {pending ? 'Menyimpan…' : 'Simpan Tampilan'}
        </button>
      </div>
    </form>
  );
}
