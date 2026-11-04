import { z } from 'zod';

import { readCheckbox } from '@/lib/user/validation';

import type { SettingsPatch } from './codec';
import {
  RECAPTCHA_KEY_PATTERN,
  SETTINGS_LIMITS,
  SETTINGS_TAB_FIELDS,
  TRUSTED_IP_HEADERS,
  type SettingsField,
} from './types';

const intField = (label: string, { min, max }: { min: number; max: number }) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, `${label} harus bilangan bulat ${min}-${max}.`)
    .transform(Number)
    .refine((n) => n >= min && n <= max, `${label} harus bilangan bulat ${min}-${max}.`);

const keyField = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || RECAPTCHA_KEY_PATTERN.test(v), `${label} tidak valid (20-100 karakter huruf, angka, - atau _).`);

const L = SETTINGS_LIMITS;

// One schema per tab: a tab's patch never contains another tab's keys.
const tabSchemas = {
  login: z.object({
    loginRateMax: intField('Batas login per username', L.loginRateMax),
    loginIpRateMax: intField('Batas login per IP', L.loginIpRateMax),
    loginRateWindowMin: intField('Jendela waktu (menit)', L.loginRateWindowMin),
  }),
  proteksi: z.object({
    trustedIpHeader: z.enum(TRUSTED_IP_HEADERS, 'Pilih header IP yang didukung.'),
    publicMutationRateMax: intField('Batas kirim formulir per IP', L.publicMutationRateMax),
    publicMutationRateWindowMin: intField('Jendela waktu kirim formulir (menit)', L.publicMutationRateWindowMin),
    publicPageRateMax: intField('Batas buka halaman per IP', L.publicPageRateMax),
    publicPageRateWindowMin: intField('Jendela waktu buka halaman (menit)', L.publicPageRateWindowMin),
    recaptchaSiteKey: keyField('Site key'),
    recaptchaSecretKey: keyField('Secret key'),
    recaptchaMinScore: z
      .string()
      .trim()
      .regex(/^(0(\.\d{1,2})?|1(\.0{1,2})?)$/, 'Ambang skor harus angka 0-1 (maks. 2 desimal), mis. 0.5.')
      .transform(Number),
  }),
};

export type EditableSettingsTab = keyof typeof SETTINGS_TAB_FIELDS;

export type SettingsValues = Partial<Record<SettingsField, string>>;

export type ParseSettingsTabResult =
  | { ok: true; patch: SettingsPatch }
  | { ok: false; fieldErrors: Partial<Record<SettingsField, string>>; values: SettingsValues };

const CHECKBOX_FIELDS: ReadonlySet<SettingsField> = new Set(['recaptchaEnabled']);

function readString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : '';
}

// Echo values for the tab's own fields only; the secret is never echoed back.
export function readSettingsValues(tab: EditableSettingsTab, formData: FormData): SettingsValues {
  const values: SettingsValues = {};
  for (const field of SETTINGS_TAB_FIELDS[tab] as readonly SettingsField[]) {
    if (field === 'recaptchaSecretKey') continue;
    values[field] = CHECKBOX_FIELDS.has(field) ? (readCheckbox(formData, field) ? '1' : '') : readString(formData, field);
  }
  return values;
}

// Tab form -> patch with only that tab's keys. Empty secret = keep the stored one (omitted from the patch).
// Enabling reCAPTCHA without a new secret still needs a stored one: checked by the caller (fresh DB read).
export function parseSettingsTab(tab: EditableSettingsTab, formData: FormData): ParseSettingsTabResult {
  const values = readSettingsValues(tab, formData);
  const raw: Record<string, string> = { ...values };
  if (tab === 'proteksi') raw.recaptchaSecretKey = readString(formData, 'recaptchaSecretKey');

  const fieldErrors: Partial<Record<SettingsField, string>> = {};
  const result = tabSchemas[tab].safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as SettingsField;
      fieldErrors[field] ??= issue.message;
    }
  }

  let patch: SettingsPatch = result.success ? { ...result.data } : {};

  if (tab === 'proteksi' && result.success) {
    const data = result.data as z.infer<(typeof tabSchemas)['proteksi']>;
    const recaptchaEnabled = values.recaptchaEnabled === '1';
    if (recaptchaEnabled && data.recaptchaSiteKey === '') {
      fieldErrors.recaptchaEnabled = 'Isi site key dan secret key sebelum mengaktifkan reCAPTCHA.';
    }
    const { recaptchaSecretKey, ...rest } = data;
    patch = { ...rest, recaptchaEnabled, ...(recaptchaSecretKey !== '' ? { recaptchaSecretKey } : {}) };
  }

  if (!result.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return { ok: true, patch };
}
