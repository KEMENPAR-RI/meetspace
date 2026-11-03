import { decodeLogo } from './codec';
import { getAppSettings } from './queries';
import { readLogoRows } from './repository';
import type { LogoMime } from './types';

export { sniffLogoMime } from './logo-sniff';

export type StoredLogo = { mime: LogoMime; data: Uint8Array; updatedAt: Date };

// Last logo kept in memory (<= 512 KB), keyed by logo_updated_at from the settings cache.
let cached: StoredLogo | null = null;

// null when no valid logo is stored (base64, size and magic bytes re-checked by the codec).
export async function getLogo(): Promise<StoredLogo | null> {
  const { logoUpdatedAt } = await getAppSettings();
  if (!logoUpdatedAt) return null;
  if (cached && cached.updatedAt.getTime() === logoUpdatedAt.getTime()) return cached;
  const logo = decodeLogo(await readLogoRows());
  if (logo) cached = logo;
  return logo;
}
