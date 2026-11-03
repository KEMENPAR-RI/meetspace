import { cacheLife, cacheTag } from 'next/cache';

import { decodeRecaptchaSecret, decodeSettings, type DecodedSettings } from './codec';
import { findUserName, readSettingRows } from './repository';
import {
  DEFAULT_APPEARANCE,
  PRIMARY_COLOR_PRESETS,
  TRUSTED_IP_HEADERS,
  type Appearance,
  type AppSettingsView,
} from './types';

// Short in-memory cache (per server bundle): changes apply everywhere within CACHE_MS.
const CACHE_MS = 30_000;
// A DB failure is remembered briefly so a down DB is not hit on every request (still fails closed).
const FAILURE_CACHE_MS = 5_000;

export const APPEARANCE_TAG = 'appearance';

// The reCAPTCHA secret is cached next to the view, never inside it (the view reaches the client).
type Snapshot = { view: AppSettingsView; recaptchaSecretKey: string };

let cache: { value: Snapshot; expiresAt: number } | undefined;
let failure: { error: unknown; expiresAt: number } | undefined;

// No auth check: also used by proxy.ts and public actions. Pages showing it must requireSuperadmin().
// Missing/invalid keys fall back to DEFAULT_APP_SETTINGS / DEFAULT_APPEARANCE; DB errors are thrown.
export async function getAppSettings(): Promise<AppSettingsView> {
  return (await getSettingsSnapshot()).view;
}

// Server-only (lib/settings/recaptcha.ts); same cache and invalidation as getAppSettings.
export async function getSettingsSnapshot(): Promise<Snapshot> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (failure && failure.expiresAt > now) throw failure.error;

  let rows;
  try {
    rows = await readSettingRows();
  } catch (error) {
    failure = { error, expiresAt: now + FAILURE_CACHE_MS };
    throw error;
  }
  failure = undefined;
  const { updatedById, ...decoded } = decodeSettings(rows);
  const view: AppSettingsView = {
    ...decoded,
    trustedIpHeaderOptions: [...TRUSTED_IP_HEADERS],
    updatedByName: updatedById ? await findUserName(updatedById) : null,
  };
  const value: Snapshot = { view, recaptchaSecretKey: decodeRecaptchaSecret(rows) };
  cache = { value, expiresAt: now + CACHE_MS };
  return value;
}

function toAppearance(s: Pick<DecodedSettings, 'appName' | 'institutionName' | 'primaryColor' | 'logoUpdatedAt'>): Appearance {
  return {
    appName: s.appName,
    institutionName: s.institutionName,
    logoUrl: s.logoUpdatedAt ? `/api/logo?v=${s.logoUpdatedAt.getTime()}` : null,
    primaryColor: s.primaryColor,
    colors: PRIMARY_COLOR_PRESETS[s.primaryColor],
  };
}

// Layout/header data, cached across requests ('use cache' + tag) so it is part of the prerendered
// shell (no colour flash). updateAppearance() calls updateTag(APPEARANCE_TAG).
// No DB (e.g. Docker build) -> defaults with a short life, refreshed in the background at runtime.
export async function getAppearance(): Promise<Appearance> {
  'use cache';
  cacheTag(APPEARANCE_TAG);
  try {
    const appearance = toAppearance(decodeSettings(await readSettingRows()));
    cacheLife('max');
    return appearance;
  } catch (error) {
    console.error('[settings] appearance unavailable; using defaults', error);
    // stale/expire >= 5 min keep it in the static shell; revalidate 60 s retries the DB.
    cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
    return toAppearance({ ...DEFAULT_APPEARANCE, institutionName: null, logoUpdatedAt: null });
  }
}

export function invalidateAppSettings(): void {
  cache = undefined;
  failure = undefined;
}
