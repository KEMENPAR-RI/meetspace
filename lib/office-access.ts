import { getAppSettings } from '@/lib/settings/queries';

import { extractClientIp } from './ip-allowlist';

// Client IP for per-IP rate limits (proxy.ts and Server Actions); settings come from app_settings (cached).

// Rate-limit key from the trusted header: IPv4 per address, IPv6 per /56 (a /64 is cheap to rotate); null = unknown.
export async function getClientIpKey(headers: Headers): Promise<string | null> {
  const { trustedIpHeader } = await getAppSettings();
  if (!trustedIpHeader) return null;
  const ip = extractClientIp(headers.get(trustedIpHeader));
  if (!ip) return null;
  const value = ip.version === 6 ? ip.value >> BigInt(72) : ip.value;
  return `${ip.version}:${value.toString(16)}`;
}
