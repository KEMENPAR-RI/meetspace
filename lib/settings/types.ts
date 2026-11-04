// App settings contract (client-safe). Stored as key-value rows; every rule is enforced in zod (lib/settings/codec.ts).

export type SettingsField =
  | 'loginRateMax'
  | 'loginIpRateMax'
  | 'loginRateWindowMin'
  | 'trustedIpHeader'
  | 'publicMutationRateMax'
  | 'publicMutationRateWindowMin'
  | 'publicPageRateMax'
  | 'publicPageRateWindowMin'
  | 'recaptchaEnabled'
  | 'recaptchaSiteKey'
  | 'recaptchaSecretKey'
  | 'recaptchaMinScore';

// Settings page tabs (?tab=). 'tampilan' is saved by updateAppearance, the rest by updateSettingsTab.
export const SETTINGS_TABS = ['tampilan', 'login', 'proteksi'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  tampilan: 'Tampilan',
  login: 'Keamanan login',
  proteksi: 'Proteksi publik',
};

// Fields each tab saves; a tab never writes another tab's keys.
export const SETTINGS_TAB_FIELDS = {
  login: ['loginRateMax', 'loginIpRateMax', 'loginRateWindowMin'],
  proteksi: [
    'trustedIpHeader',
    'publicMutationRateMax',
    'publicMutationRateWindowMin',
    'publicPageRateMax',
    'publicPageRateWindowMin',
    'recaptchaEnabled',
    'recaptchaSiteKey',
    'recaptchaSecretKey',
    'recaptchaMinScore',
  ],
} as const satisfies Record<Exclude<SettingsTab, 'tampilan'>, readonly SettingsField[]>;

export function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === 'string' && (SETTINGS_TABS as readonly string[]).includes(value);
}

// reCAPTCHA v3 site/secret key format ('' = not set).
export const RECAPTCHA_KEY_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

export const SETTINGS_LIMITS = {
  loginRateMax: { min: 1, max: 1000 },
  loginIpRateMax: { min: 1, max: 1000 },
  loginRateWindowMin: { min: 1, max: 1440 },
  publicMutationRateMax: { min: 1, max: 1000 },
  publicMutationRateWindowMin: { min: 1, max: 1440 },
  publicPageRateMax: { min: 1, max: 10000 },
  publicPageRateWindowMin: { min: 1, max: 1440 },
  recaptchaMinScore: { min: 0, max: 1 },
} as const;

// Headers a reverse proxy may set with the client IP; the rightmost entry is used.
// No "remote address" option: Next.js exposes no socket address to proxy/actions.
export const TRUSTED_IP_HEADERS = ['x-real-ip', 'x-forwarded-for', 'cf-connecting-ip'] as const;
export type TrustedIpHeader = (typeof TRUSTED_IP_HEADERS)[number];

export const TRUSTED_IP_HEADER_LABELS: Record<TrustedIpHeader, string> = {
  'x-real-ip': 'X-Real-IP (nginx / aaPanel)',
  'x-forwarded-for': 'X-Forwarded-For (entri paling kanan)',
  'cf-connecting-ip': 'CF-Connecting-IP (Cloudflare)',
};

export const DEFAULT_TRUSTED_IP_HEADER: TrustedIpHeader = 'x-real-ip';

export function isTrustedIpHeader(value: unknown): value is TrustedIpHeader {
  return typeof value === 'string' && (TRUSTED_IP_HEADERS as readonly string[]).includes(value);
}

// Single source of defaults (same as the migration seed): app usable before the settings are filled in.
export const DEFAULT_APP_SETTINGS = {
  loginRateMax: 10,
  loginIpRateMax: 50,
  loginRateWindowMin: 15,
  trustedIpHeader: 'x-real-ip',
  publicMutationRateMax: 5,
  publicMutationRateWindowMin: 10,
  publicPageRateMax: 300,
  publicPageRateWindowMin: 5,
  recaptchaEnabled: false,
  recaptchaSiteKey: '',
  recaptchaMinScore: 0.5,
} as const satisfies Record<string, unknown>;

export type AppSettings = {
  loginRateMax: number;
  loginIpRateMax: number;
  loginRateWindowMin: number;
  // '' = stored value is not an allowed header (no client IP: per-IP limits refuse anonymous requests).
  trustedIpHeader: TrustedIpHeader | '';
  publicMutationRateMax: number;
  publicMutationRateWindowMin: number;
  publicPageRateMax: number;
  publicPageRateWindowMin: number;
  // Effective: true only when stored true and both keys are set. The secret is never part of this type.
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaMinScore: number;
};

// ---- Appearance (app name, institution, logo, primary color) ----

export type AppearanceField = 'appName' | 'institutionName' | 'primaryColor' | 'logo' | 'removeLogo';

export const APPEARANCE_LIMITS = {
  appName: 80,
  institutionName: 120,
  // Bytes; matches the logo size CHECK in the migration SQL.
  logoMaxBytes: 512 * 1024,
} as const;

export const LOGO_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type LogoMime = (typeof LOGO_MIMES)[number];

export function isLogoMime(value: unknown): value is LogoMime {
  return typeof value === 'string' && (LOGO_MIMES as readonly string[]).includes(value);
}

export const PRIMARY_COLORS = ['navy', 'blue', 'green', 'teal', 'red', 'purple', 'orange'] as const;
export type PrimaryColor = (typeof PRIMARY_COLORS)[number];

export type ColorTokens = {
  label: string;
  // Main brand color; white text on it meets WCAG AA (>= 4.5:1).
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  // Accent (borders, focus rings) and a light tint for backgrounds; dark text on the tint is AA.
  secondary: string;
  primarySoft: string;
};

export const PRIMARY_COLOR_PRESETS: Record<PrimaryColor, ColorTokens> = {
  navy: { label: 'Navy', primary: '#1e3a5f', primaryHover: '#162c48', primaryForeground: '#ffffff', secondary: '#c9a227', primarySoft: '#e8eef6' },
  blue: { label: 'Biru', primary: '#1d4ed8', primaryHover: '#1e40af', primaryForeground: '#ffffff', secondary: '#60a5fa', primarySoft: '#eff6ff' },
  green: { label: 'Hijau', primary: '#15803d', primaryHover: '#166534', primaryForeground: '#ffffff', secondary: '#4ade80', primarySoft: '#f0fdf4' },
  teal: { label: 'Toska', primary: '#0f766e', primaryHover: '#115e59', primaryForeground: '#ffffff', secondary: '#2dd4bf', primarySoft: '#f0fdfa' },
  red: { label: 'Merah', primary: '#b91c1c', primaryHover: '#991b1b', primaryForeground: '#ffffff', secondary: '#f87171', primarySoft: '#fef2f2' },
  purple: { label: 'Ungu', primary: '#6d28d9', primaryHover: '#5b21b6', primaryForeground: '#ffffff', secondary: '#a78bfa', primarySoft: '#f5f3ff' },
  orange: { label: 'Oranye', primary: '#c2410c', primaryHover: '#9a3412', primaryForeground: '#ffffff', secondary: '#fb923c', primarySoft: '#fff7ed' },
};

export const DEFAULT_APPEARANCE = { appName: 'Booking Rapat', primaryColor: 'navy' } as const satisfies {
  appName: string;
  primaryColor: PrimaryColor;
};

// For layouts/headers (client-safe, serializable).
export type Appearance = {
  appName: string;
  institutionName: string | null;
  // `/api/logo?v=<logoUpdatedAt ms>` or null.
  logoUrl: string | null;
  primaryColor: PrimaryColor;
  colors: ColorTokens;
};

// getAppSettings() result: effective values + appearance + audit info for the settings page.
export type AppSettingsView = AppSettings & {
  trustedIpHeaderOptions: TrustedIpHeader[];
  recaptchaSecretSet: boolean;
  appName: string;
  institutionName: string | null;
  primaryColor: PrimaryColor;
  logoMime: LogoMime | null;
  logoUpdatedAt: Date | null;
  updatedAt: Date | null;
  updatedByName: string | null;
};
