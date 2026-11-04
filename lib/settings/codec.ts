import { z } from 'zod';

import { sniffLogoMime } from './logo-sniff';
import {
  APPEARANCE_LIMITS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_APPEARANCE,
  LOGO_MIMES,
  PRIMARY_COLORS,
  RECAPTCHA_KEY_PATTERN,
  SETTINGS_LIMITS,
  TRUSTED_IP_HEADERS,
  type AppSettings,
  type LogoMime,
  type PrimaryColor,
} from './types';

// Pure key-value codec for app_settings rows { key, value }: every rule the DB used to enforce
// (CHECK ranges, logo mime/size, color preset) is checked here. Missing/invalid keys fall back to defaults.

export const SETTING_KEYS = {
  loginRateMax: 'login_rate_max',
  loginIpRateMax: 'login_ip_rate_max',
  loginRateWindowMin: 'login_rate_window_min',
  trustedIpHeader: 'trusted_ip_header',
  publicMutationRateMax: 'public_mutation_rate_max',
  publicMutationRateWindowMin: 'public_mutation_rate_window_min',
  publicPageRateMax: 'public_page_rate_max',
  publicPageRateWindowMin: 'public_page_rate_window_min',
  recaptchaEnabled: 'recaptcha_enabled',
  recaptchaSiteKey: 'recaptcha_site_key',
  recaptchaSecretKey: 'recaptcha_secret_key',
  recaptchaMinScore: 'recaptcha_min_score',
  appName: 'app_name',
  institutionName: 'institution_name',
  primaryColor: 'primary_color',
  logo: 'logo',
  logoMime: 'logo_mime',
  logoUpdatedAt: 'logo_updated_at',
  updatedAt: 'updated_at',
  updatedById: 'updated_by_id',
} as const;

export type SettingRow = { key: string; value: string };

export type DecodedSettings = AppSettings & {
  recaptchaSecretSet: boolean;
  appName: string;
  institutionName: string | null;
  primaryColor: PrimaryColor;
  logoMime: LogoMime | null;
  logoUpdatedAt: Date | null;
  updatedAt: Date | null;
  updatedById: string | null;
};

export type DecodedLogo = { mime: LogoMime; data: Uint8Array; updatedAt: Date };

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// base64 of <= 512 KB is <= ~700 KB of text.
const LOGO_B64_MAX = Math.ceil(APPEARANCE_LIMITS.logoMaxBytes / 3) * 4;

const int = ({ min, max }: { min: number; max: number }) =>
  z
    .string()
    .regex(/^\d{1,5}$/)
    .transform(Number)
    .refine((n) => n >= min && n <= max);

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v))
  .transform((v) => new Date(v));

const schemas = {
  loginRateMax: int(SETTINGS_LIMITS.loginRateMax),
  loginIpRateMax: int(SETTINGS_LIMITS.loginIpRateMax),
  loginRateWindowMin: int(SETTINGS_LIMITS.loginRateWindowMin),
  publicMutationRateMax: int(SETTINGS_LIMITS.publicMutationRateMax),
  publicMutationRateWindowMin: int(SETTINGS_LIMITS.publicMutationRateWindowMin),
  publicPageRateMax: int(SETTINGS_LIMITS.publicPageRateMax),
  publicPageRateWindowMin: int(SETTINGS_LIMITS.publicPageRateWindowMin),
  recaptchaEnabled: z.enum(['true', 'false']).transform((v) => v === 'true'),
  // '' = not set.
  recaptchaKey: z.string().refine((v) => v === '' || RECAPTCHA_KEY_PATTERN.test(v)),
  recaptchaMinScore: z
    .string()
    .regex(/^(0(\.\d{1,2})?|1(\.0{1,2})?)$/)
    .transform(Number),
  appName: z
    .string()
    .trim()
    .min(1)
    .max(APPEARANCE_LIMITS.appName)
    .refine((v) => !CONTROL_CHARS.test(v)),
  institutionName: z
    .string()
    .trim()
    .max(APPEARANCE_LIMITS.institutionName)
    .refine((v) => !CONTROL_CHARS.test(v))
    .transform((v) => (v === '' ? null : v)),
  primaryColor: z.enum(PRIMARY_COLORS),
  logoMime: z.enum(LOGO_MIMES),
  logoUpdatedAt: isoDate,
  updatedAt: isoDate,
  updatedById: z.string().regex(UUID),
};

function pick<T>(map: Map<string, string>, key: string, schema: z.ZodType<T>, fallback: T): T {
  const raw = map.get(key);
  if (raw === undefined) return fallback;
  const r = schema.safeParse(raw);
  return r.success ? r.data : fallback;
}

// Logo blob not needed (decodeLogo reads it only when needed).
export function decodeSettings(rows: readonly SettingRow[]): DecodedSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const K = SETTING_KEYS;
  const D = DEFAULT_APP_SETTINGS;

  // Missing header key -> default; a stored but unsupported header -> '' (no client IP: per-IP limits fail closed).
  const rawHeader = map.get(K.trustedIpHeader);
  const header = rawHeader === undefined ? D.trustedIpHeader : rawHeader.trim().toLowerCase();

  const logoMime = pick(map, K.logoMime, schemas.logoMime, null);
  const logoUpdatedAt = pick(map, K.logoUpdatedAt, schemas.logoUpdatedAt, null);
  // The blob is not read here; removal writes '' to all three keys, so mime + timestamp mark a logo.
  const hasLogo = logoMime !== null && logoUpdatedAt !== null;

  const recaptchaStored = pick(map, K.recaptchaEnabled, schemas.recaptchaEnabled, D.recaptchaEnabled);
  const siteKey = pick(map, K.recaptchaSiteKey, schemas.recaptchaKey, D.recaptchaSiteKey);
  const secretSet = decodeRecaptchaSecret(rows) !== '';

  return {
    loginRateMax: pick(map, K.loginRateMax, schemas.loginRateMax, D.loginRateMax),
    loginIpRateMax: pick(map, K.loginIpRateMax, schemas.loginIpRateMax, D.loginIpRateMax),
    loginRateWindowMin: pick(map, K.loginRateWindowMin, schemas.loginRateWindowMin, D.loginRateWindowMin),
    trustedIpHeader: (TRUSTED_IP_HEADERS as readonly string[]).includes(header)
      ? (header as AppSettings['trustedIpHeader'])
      : '',
    publicMutationRateMax: pick(map, K.publicMutationRateMax, schemas.publicMutationRateMax, D.publicMutationRateMax),
    publicMutationRateWindowMin: pick(
      map,
      K.publicMutationRateWindowMin,
      schemas.publicMutationRateWindowMin,
      D.publicMutationRateWindowMin,
    ),
    publicPageRateMax: pick(map, K.publicPageRateMax, schemas.publicPageRateMax, D.publicPageRateMax),
    publicPageRateWindowMin: pick(map, K.publicPageRateWindowMin, schemas.publicPageRateWindowMin, D.publicPageRateWindowMin),
    // Defence in depth: never "on" without both keys.
    recaptchaEnabled: recaptchaStored && siteKey !== '' && secretSet,
    recaptchaSiteKey: siteKey,
    recaptchaSecretSet: secretSet,
    recaptchaMinScore: pick(map, K.recaptchaMinScore, schemas.recaptchaMinScore, D.recaptchaMinScore),
    appName: pick(map, K.appName, schemas.appName, DEFAULT_APPEARANCE.appName),
    institutionName: pick(map, K.institutionName, schemas.institutionName, null),
    primaryColor: pick(map, K.primaryColor, schemas.primaryColor, DEFAULT_APPEARANCE.primaryColor),
    logoMime: hasLogo ? logoMime : null,
    logoUpdatedAt: hasLogo ? logoUpdatedAt : null,
    updatedAt: pick(map, K.updatedAt, schemas.updatedAt, null),
    updatedById: pick(map, K.updatedById, schemas.updatedById, null),
  };
}

// Server-only use (lib/settings/recaptcha.ts); '' when missing or malformed. Never put the result in a view.
export function decodeRecaptchaSecret(rows: readonly SettingRow[]): string {
  const raw = rows.find((r) => r.key === SETTING_KEYS.recaptchaSecretKey)?.value;
  return raw !== undefined && RECAPTCHA_KEY_PATTERN.test(raw) ? raw : '';
}

// null unless logo + mime + timestamp are present, the base64 is valid, <= 512 KB, and the magic bytes match the mime.
export function decodeLogo(rows: readonly SettingRow[]): DecodedLogo | null {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const mime = pick(map, SETTING_KEYS.logoMime, schemas.logoMime, null);
  const updatedAt = pick(map, SETTING_KEYS.logoUpdatedAt, schemas.logoUpdatedAt, null);
  const b64 = map.get(SETTING_KEYS.logo);
  if (!mime || !updatedAt || !b64 || b64.length > LOGO_B64_MAX || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const data = new Uint8Array(Buffer.from(b64, 'base64'));
  if (data.length > APPEARANCE_LIMITS.logoMaxBytes || sniffLogoMime(data) !== mime) return null;
  return { mime, data, updatedAt };
}

export type SettingsPatch = Partial<
  AppSettings & {
    appName: string;
    institutionName: string | null;
    primaryColor: PrimaryColor;
    // '' = remove the secret.
    recaptchaSecretKey: string;
    // null = remove the logo.
    logo: { mime: LogoMime; data: Uint8Array } | null;
  }
>;

// Rows to upsert for a validated patch (+ audit keys). Throws on values the rules forbid (defence in depth).
export function encodeSettings(patch: SettingsPatch, updatedById: string, now: Date): SettingRow[] {
  const K = SETTING_KEYS;
  const rows: SettingRow[] = [];
  const put = <T>(key: string, schema: z.ZodType<T>, value: string) => {
    if (!schema.safeParse(value).success) throw new Error(`[settings] invalid value for ${key}`);
    rows.push({ key, value });
  };

  if (patch.loginRateMax !== undefined) put(K.loginRateMax, schemas.loginRateMax, String(patch.loginRateMax));
  if (patch.loginIpRateMax !== undefined) put(K.loginIpRateMax, schemas.loginIpRateMax, String(patch.loginIpRateMax));
  if (patch.loginRateWindowMin !== undefined) {
    put(K.loginRateWindowMin, schemas.loginRateWindowMin, String(patch.loginRateWindowMin));
  }
  if (patch.publicMutationRateMax !== undefined) {
    put(K.publicMutationRateMax, schemas.publicMutationRateMax, String(patch.publicMutationRateMax));
  }
  if (patch.publicMutationRateWindowMin !== undefined) {
    put(K.publicMutationRateWindowMin, schemas.publicMutationRateWindowMin, String(patch.publicMutationRateWindowMin));
  }
  if (patch.publicPageRateMax !== undefined) put(K.publicPageRateMax, schemas.publicPageRateMax, String(patch.publicPageRateMax));
  if (patch.publicPageRateWindowMin !== undefined) {
    put(K.publicPageRateWindowMin, schemas.publicPageRateWindowMin, String(patch.publicPageRateWindowMin));
  }
  if (patch.recaptchaEnabled !== undefined) put(K.recaptchaEnabled, schemas.recaptchaEnabled, String(patch.recaptchaEnabled));
  if (patch.recaptchaSiteKey !== undefined) put(K.recaptchaSiteKey, schemas.recaptchaKey, patch.recaptchaSiteKey);
  if (patch.recaptchaSecretKey !== undefined) put(K.recaptchaSecretKey, schemas.recaptchaKey, patch.recaptchaSecretKey);
  if (patch.recaptchaMinScore !== undefined) put(K.recaptchaMinScore, schemas.recaptchaMinScore, String(patch.recaptchaMinScore));
  if (patch.trustedIpHeader !== undefined) put(K.trustedIpHeader, z.enum(TRUSTED_IP_HEADERS), patch.trustedIpHeader);
  if (patch.appName !== undefined) put(K.appName, schemas.appName, patch.appName);
  if (patch.institutionName !== undefined) put(K.institutionName, schemas.institutionName, patch.institutionName ?? '');
  if (patch.primaryColor !== undefined) put(K.primaryColor, schemas.primaryColor, patch.primaryColor);
  if (patch.logo === null) {
    rows.push({ key: K.logo, value: '' }, { key: K.logoMime, value: '' }, { key: K.logoUpdatedAt, value: '' });
  } else if (patch.logo) {
    const { mime, data } = patch.logo;
    if (data.length > APPEARANCE_LIMITS.logoMaxBytes || sniffLogoMime(data) !== mime) {
      throw new Error('[settings] invalid logo');
    }
    rows.push(
      { key: K.logo, value: Buffer.from(data).toString('base64') },
      { key: K.logoMime, value: mime },
      { key: K.logoUpdatedAt, value: now.toISOString() },
    );
  }
  rows.push({ key: K.updatedAt, value: now.toISOString() }, { key: K.updatedById, value: updatedById });
  return rows;
}
