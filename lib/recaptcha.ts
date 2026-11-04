import { z } from 'zod';

import { getPublicBaseUrl } from '@/lib/public-url';
import { getRecaptchaServerConfig } from '@/lib/settings/recaptcha';

// reCAPTCHA v3 server verification. Server-only. Fails closed when Google or the settings are unreachable.

export type RecaptchaAction = 'booking' | 'login';

export type RecaptchaResult =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'missing' | 'invalid' | 'action' | 'hostname' | 'score' | 'unavailable' };

export const RECAPTCHA_FAILED_MESSAGE = 'Verifikasi keamanan gagal, muat ulang halaman dan coba lagi.';
export const RECAPTCHA_NOT_CONFIGURED_MESSAGE =
  'Booking online belum dapat digunakan: verifikasi keamanan (reCAPTCHA) belum diaktifkan admin. Hubungi admin.';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const TIMEOUT_MS = 5000;
const TOKEN_MAX = 4096;
const TOKEN_RE = /^[A-Za-z0-9_\-.+/=]+$/;
// Google errors caused by our own config, not by the client.
const CONFIG_ERRORS = new Set(['missing-input-secret', 'invalid-input-secret', 'bad-request']);

const responseSchema = z.object({
  success: z.boolean(),
  score: z.number().optional(),
  action: z.string().optional(),
  hostname: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
});

function appHostname(): string | null {
  const base = getPublicBaseUrl();
  return base ? new URL(base).hostname.toLowerCase() : null;
}

function reject(
  reason: Exclude<RecaptchaResult, { ok: true }>['reason'],
  action: RecaptchaAction,
  extra: { score?: number; errorCodes?: string[]; hostname?: string } = {},
): RecaptchaResult {
  // Never log the token or the secret.
  const log = reason === 'unavailable' ? console.error : console.warn;
  log(`[recaptcha] ${reason === 'unavailable' ? 'unavailable' : 'rejected'}`, { reason, action, ...extra });
  return { ok: false, reason };
}

// Off -> { ok: true }, or 'not-configured' when `required` (never fails open).
// `remoteIp` (optional) must be a plain IP, not a rate-limit key.
export async function verifyRecaptcha(
  token: unknown,
  action: RecaptchaAction,
  { required = false, remoteIp }: { required?: boolean; remoteIp?: string } = {},
): Promise<RecaptchaResult> {
  let config;
  try {
    config = await getRecaptchaServerConfig();
  } catch (error) {
    console.error('[recaptcha] settings unavailable', error);
    return { ok: false, reason: 'unavailable' };
  }
  if (!config.enabled) return required ? reject('not-configured', action) : { ok: true };

  if (typeof token !== 'string' || token.length === 0 || token.length > TOKEN_MAX || !TOKEN_RE.test(token)) {
    return reject('missing', action);
  }

  const body = new URLSearchParams({ secret: config.secretKey, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  let data: z.infer<typeof responseSchema>;
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return reject('unavailable', action, { errorCodes: [`http-${res.status}`] });
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) return reject('unavailable', action, { errorCodes: ['bad-response'] });
    data = parsed.data;
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown';
    return reject('unavailable', action, { errorCodes: [name] });
  }

  const errorCodes = data['error-codes'];
  if (!data.success) {
    // Expired or reused tokens come back as 'timeout-or-duplicate'.
    const configError = errorCodes?.some((c) => CONFIG_ERRORS.has(c));
    return reject(configError ? 'unavailable' : 'invalid', action, { errorCodes });
  }
  if (data.action !== action) return reject('action', action, { score: data.score, errorCodes });
  // Token must come from our own host; checked only when APP_URL is set (the app has no other trusted host).
  const expectedHost = appHostname();
  if (expectedHost && data.hostname?.toLowerCase() !== expectedHost) {
    return reject('hostname', action, { hostname: data.hostname?.slice(0, 255), errorCodes });
  }
  if (data.score === undefined || data.score < config.minScore) {
    return reject('score', action, { score: data.score, errorCodes });
  }
  return { ok: true };
}
