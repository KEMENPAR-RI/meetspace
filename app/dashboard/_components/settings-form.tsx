'use client';

import { startTransition, useActionState, useState } from 'react';
import { LoaderCircle, Save, Trash2, TriangleAlert } from 'lucide-react';
import { clearRecaptchaSecret, updateSettingsTab } from '@/app/actions/settings';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { initialFormState } from '@/lib/auth/types';
import {
  SETTINGS_LIMITS,
  TRUSTED_IP_HEADER_LABELS,
  isTrustedIpHeader,
  type AppSettingsView,
  type SettingsField,
  type SettingsTab,
  type TrustedIpHeader,
} from '@/lib/settings/types';
import {
  Badge,
  Field,
  FormMessage,
  cardClass,
  dangerButton,
  fieldAria,
  inputClass,
  primaryButton,
  readValue,
} from './ui';

// One form per tab; each saves only its own fields (tab is bound, the server re-validates it).

type NumberKey =
  | 'loginRateMax'
  | 'loginIpRateMax'
  | 'loginRateWindowMin'
  | 'publicMutationRateMax'
  | 'publicMutationRateWindowMin'
  | 'publicPageRateMax'
  | 'publicPageRateWindowMin';

function useTabForm<K extends SettingsField>(tab: SettingsTab, initial: Pick<AppSettingsView, K & keyof AppSettingsView>) {
  const [state, formAction, pending] = useActionState(updateSettingsTab.bind(null, tab), initialFormState);
  const errors = state.fieldErrors ?? {};
  // After a failed save keep what was typed; otherwise saved data.
  const submitted = state.status === 'error' ? state.values : undefined;
  const text = (name: K & keyof AppSettingsView) =>
    submitted ? (readValue(submitted, name) ?? '') : String(initial[name] ?? '');
  const checked = (name: K & keyof AppSettingsView) =>
    submitted ? readValue(submitted, name) === '1' : initial[name] === true;
  return { state, formAction, pending, errors, text, checked };
}

function NumberField({
  name,
  label,
  hint,
  error,
  defaultValue,
}: {
  name: NumberKey;
  label: string;
  hint: string;
  error?: string;
  defaultValue: string;
}) {
  return (
    <Field label={label} id={`set-${name}`} error={error} hint={hint}>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        required
        step={1}
        min={SETTINGS_LIMITS[name].min}
        max={SETTINGS_LIMITS[name].max}
        defaultValue={defaultValue}
        className={`${inputClass} tabular-nums`}
        {...fieldAria(`set-${name}`, error, true)}
      />
    </Field>
  );
}

const range = (name: NumberKey, unit: string) =>
  `${unit}, ${SETTINGS_LIMITS[name].min}–${SETTINGS_LIMITS[name].max.toLocaleString('id-ID')}.`;

function TabCard({ id, title, description, children }: { id: string; title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={cardClass}>
      <h2 id={id} className="text-base font-semibold text-primary">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SaveBar({ pending }: { pending: boolean }) {
  return (
    <div className="flex justify-end">
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <Save className="size-4" />}
        {pending ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  );
}

// ---- Keamanan login ----

type LoginKeys = 'loginRateMax' | 'loginIpRateMax' | 'loginRateWindowMin';

export function LoginSettingsForm({ initial }: { initial: Pick<AppSettingsView, LoginKeys> }) {
  const { state, formAction, pending, errors, text } = useTabForm<LoginKeys>('login', initial);
  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />
      <TabCard id="sec-login" title="Keamanan login" description="Batas percobaan login gagal sebelum diblokir sementara.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
          <NumberField name="loginRateMax" label="Per username" hint={range('loginRateMax', 'Percobaan')} error={errors.loginRateMax} defaultValue={text('loginRateMax')} />
          <NumberField name="loginIpRateMax" label="Per IP" hint={range('loginIpRateMax', 'Percobaan')} error={errors.loginIpRateMax} defaultValue={text('loginIpRateMax')} />
          <NumberField name="loginRateWindowMin" label="Jendela waktu" hint={range('loginRateWindowMin', 'Menit')} error={errors.loginRateWindowMin} defaultValue={text('loginRateWindowMin')} />
        </div>
      </TabCard>
      <SaveBar pending={pending} />
    </form>
  );
}

// ---- Proteksi publik (IP klien + rate limit + reCAPTCHA) ----

type ProtectionKeys =
  | 'trustedIpHeader'
  | 'publicMutationRateMax'
  | 'publicMutationRateWindowMin'
  | 'publicPageRateMax'
  | 'publicPageRateWindowMin'
  | 'recaptchaEnabled'
  | 'recaptchaSiteKey'
  | 'recaptchaMinScore';

export function ProtectionSettingsForm({
  initial,
  headerOptions,
}: {
  initial: Pick<AppSettingsView, ProtectionKeys | 'recaptchaSecretSet'>;
  headerOptions: TrustedIpHeader[];
}) {
  const { state, formAction, pending, errors, text, checked } = useTabForm<ProtectionKeys>('proteksi', initial);
  const header = text('trustedIpHeader');
  const [pickedHeader, setPickedHeader] = useState(header);

  return (
    <div className="space-y-6">
      {!initial.recaptchaEnabled && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
          <p>
            <span className="font-semibold">reCAPTCHA belum aktif, booking publik ditolak.</span> Semua kiriman form
            booking dari halaman publik ditolak sampai reCAPTCHA diaktifkan dengan site key dan secret key. Login
            dashboard tetap berjalan.
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <FormMessage state={state} />

        <TabCard
          id="sec-ip"
          title="Alamat IP klien"
          description="Menentukan dari header mana alamat IP pengunjung dibaca."
        >
          <div className="space-y-5">
            <Field
              label="Header IP tepercaya"
              id="set-trustedIpHeader"
              error={errors.trustedIpHeader}
              hint="Header yang diisi reverse proxy dengan IP klien asli; dipakai untuk batas login dan batas request per IP. Harus di-set (ditimpa) oleh nginx, bukan diteruskan dari klien."
            >
              <select
                name="trustedIpHeader"
                value={pickedHeader}
                onChange={(e) => setPickedHeader(e.currentTarget.value)}
                className={inputClass}
                {...fieldAria('set-trustedIpHeader', errors.trustedIpHeader, true)}
              >
                {/* Stored value invalid: force an explicit choice. */}
                {!isTrustedIpHeader(header) && (
                  <option value="" disabled>
                    Pilih header…
                  </option>
                )}
                {headerOptions.map((h) => (
                  <option key={h} value={h}>
                    {TRUSTED_IP_HEADER_LABELS[h]}
                  </option>
                ))}
              </select>
            </Field>
            {pickedHeader === 'cf-connecting-ip' && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span className="min-w-0">
                  <span className="font-semibold">Gunakan hanya bila server hanya menerima trafik dari Cloudflare;</span>{' '}
                  jika tidak, IP bisa dipalsukan.
                </span>
              </p>
            )}
          </div>
        </TabCard>

        <TabCard
          id="sec-rate"
          title="Batas request publik"
          description="Berlaku untuk pengunjung tanpa login, dihitung per alamat IP."
        >
          <div className="space-y-6">
            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold text-zinc-800">Kirim formulir booking</legend>
              <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
                <NumberField name="publicMutationRateMax" label="Maksimal kiriman" hint={range('publicMutationRateMax', 'Kiriman')} error={errors.publicMutationRateMax} defaultValue={text('publicMutationRateMax')} />
                <NumberField name="publicMutationRateWindowMin" label="Jendela waktu" hint={range('publicMutationRateWindowMin', 'Menit')} error={errors.publicMutationRateWindowMin} defaultValue={text('publicMutationRateWindowMin')} />
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold text-zinc-800">Buka halaman publik (beranda, ruangan, logo)</legend>
              <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
                <NumberField name="publicPageRateMax" label="Maksimal request" hint={range('publicPageRateMax', 'Request')} error={errors.publicPageRateMax} defaultValue={text('publicPageRateMax')} />
                <NumberField name="publicPageRateWindowMin" label="Jendela waktu" hint={range('publicPageRateWindowMin', 'Menit')} error={errors.publicPageRateWindowMin} defaultValue={text('publicPageRateWindowMin')} />
              </div>
            </fieldset>
          </div>
        </TabCard>

        <TabCard
          id="sec-recaptcha"
          title="reCAPTCHA v3"
          description="Verifikasi bot tanpa tantangan visual. Wajib untuk form booking publik; juga dipakai di login dashboard bila aktif. Kunci dibuat di Google reCAPTCHA Admin Console (tipe v3)."
        >
          <div className="space-y-5">
            <div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="recaptchaEnabled"
                  value="1"
                  // Remount when the saved value changes (e.g. after clearing the secret).
                  key={String(initial.recaptchaEnabled)}
                  defaultChecked={checked('recaptchaEnabled')}
                  aria-invalid={errors.recaptchaEnabled ? true : undefined}
                  aria-describedby={errors.recaptchaEnabled ? 'set-recaptchaEnabled-error' : undefined}
                  className="mt-0.5 size-4 rounded border-zinc-300 accent-primary"
                />
                <span className="text-sm">
                  <span className="block font-medium text-zinc-800">Aktifkan reCAPTCHA</span>
                  <span className="block text-xs text-zinc-500">Butuh site key dan secret key. Nonaktif = booking publik ditolak. Bila Google tidak bisa dihubungi, kiriman publik juga ditolak.</span>
                </span>
              </label>
              {errors.recaptchaEnabled && (
                <p id="set-recaptchaEnabled-error" className="mt-1.5 text-sm text-red-600">
                  {errors.recaptchaEnabled}
                </p>
              )}
            </div>

            <Field label="Site key" id="set-recaptchaSiteKey" error={errors.recaptchaSiteKey} hint="Kunci publik; tampil di halaman.">
              <input
                name="recaptchaSiteKey"
                type="text"
                maxLength={100}
                autoComplete="off"
                spellCheck={false}
                defaultValue={text('recaptchaSiteKey')}
                className={`${inputClass} font-mono`}
                {...fieldAria('set-recaptchaSiteKey', errors.recaptchaSiteKey, true)}
              />
            </Field>

            <SecretField error={errors.recaptchaSecretKey} secretSet={initial.recaptchaSecretSet} />

            <div className="max-w-xs">
              <Field
                label="Skor minimum"
                id="set-recaptchaMinScore"
                error={errors.recaptchaMinScore}
                hint="0–1; makin tinggi makin ketat. Disarankan 0.5."
              >
                <input
                  name="recaptchaMinScore"
                  type="number"
                  inputMode="decimal"
                  required
                  step={0.01}
                  min={SETTINGS_LIMITS.recaptchaMinScore.min}
                  max={SETTINGS_LIMITS.recaptchaMinScore.max}
                  defaultValue={text('recaptchaMinScore')}
                  className={`${inputClass} tabular-nums`}
                  {...fieldAria('set-recaptchaMinScore', errors.recaptchaMinScore, true)}
                />
              </Field>
            </div>
          </div>
        </TabCard>

        <SaveBar pending={pending} />
      </form>
    </div>
  );
}

// Write-only: the stored secret never reaches the browser; empty input keeps it.
function SecretField({ error, secretSet }: { error?: string; secretSet: boolean }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="set-recaptchaSecretKey" className="block text-sm font-medium text-zinc-800">
          Secret key
        </label>
        <Badge tone={secretSet ? 'success' : 'neutral'}>{secretSet ? 'Sudah tersimpan' : 'Belum diset'}</Badge>
      </div>
      <input
        name="recaptchaSecretKey"
        type="password"
        maxLength={100}
        autoComplete="new-password"
        spellCheck={false}
        placeholder={secretSet ? '•••••••• (kosongkan untuk mempertahankan)' : 'Tempel secret key'}
        className={`${inputClass} font-mono`}
        {...fieldAria('set-recaptchaSecretKey', error, true)}
      />
      <p id="set-recaptchaSecretKey-hint" className="text-xs text-zinc-500">
        Tidak ditampilkan kembali setelah disimpan. Isi hanya untuk mengganti.
      </p>
      {error && (
        <p id="set-recaptchaSecretKey-error" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {secretSet && <ClearSecretButton />}
    </div>
  );
}

function ClearSecretButton() {
  const [state, dispatch, pending] = useActionState(clearRecaptchaSecret, initialFormState);
  const { confirm, confirmDialog } = useConfirm();

  const onClick = async () => {
    const ok = await confirm({
      title: 'Hapus secret key?',
      message: 'Secret key reCAPTCHA akan dihapus dan reCAPTCHA dinonaktifkan. Booking publik akan ditolak sampai reCAPTCHA diaktifkan kembali.',
      confirmText: 'Ya, hapus',
      cancelText: 'Batal',
      tone: 'danger',
    });
    if (ok) startTransition(() => dispatch(new FormData()));
  };

  return (
    <div className="space-y-2 pt-1">
      {/* type=button: sits inside the tab form without submitting it */}
      <button type="button" onClick={onClick} disabled={pending} className={dangerButton}>
        <Trash2 className="size-4" />
        {pending ? 'Menghapus…' : 'Hapus secret key'}
      </button>
      <FormMessage state={state} />
      {confirmDialog}
    </div>
  );
}
