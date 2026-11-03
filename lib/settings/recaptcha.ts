import { decodeRecaptchaSecret } from './codec';
import { getSettingsSnapshot } from './queries';
import { readSettingRows } from './repository';

// Server-only: never import from a client component; never return secretKey to a page or action result.

export type RecaptchaServerConfig = { enabled: boolean; siteKey: string; secretKey: string; minScore: number };

// Cached 30 s with the other settings (invalidated by invalidateAppSettings). DB errors are thrown.
export async function getRecaptchaServerConfig(): Promise<RecaptchaServerConfig> {
  const { view, recaptchaSecretKey } = await getSettingsSnapshot();
  return {
    enabled: view.recaptchaEnabled,
    siteKey: view.recaptchaSiteKey,
    secretKey: recaptchaSecretKey,
    minScore: view.recaptchaMinScore,
  };
}

// For public pages: null = reCAPTCHA off (do not load the script).
export async function getRecaptchaSiteKey(): Promise<string | null> {
  const { view } = await getSettingsSnapshot();
  return view.recaptchaEnabled ? view.recaptchaSiteKey : null;
}

// Fresh DB read (not the 30 s cache), used before enabling reCAPTCHA without a new secret.
export async function hasStoredRecaptchaSecret(): Promise<boolean> {
  return decodeRecaptchaSecret(await readSettingRows()) !== '';
}
