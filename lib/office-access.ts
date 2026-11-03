import { getAppSettings } from '@/lib/settings/queries';

import { extractClientIp, isIpAllowed, parseAllowlist, type IpRule } from './ip-allowlist';

// Shared by proxy.ts and public Server Actions; settings come from app_settings (cached). Fails closed.

export type OfficeDenyReason = 'not-configured' | 'invalid-config' | 'invalid-header-name' | 'missing-ip' | 'not-allowed';

export type OfficeAccessResult = { allowed: true } | { allowed: false; reason: OfficeDenyReason };

let allowlistCache: { raw: string; rules: IpRule[] | null } | undefined;

function getAllowlist(raw: string): IpRule[] | null {
  if (allowlistCache?.raw !== raw) allowlistCache = { raw, rules: parseAllowlist(raw) };
  return allowlistCache.rules;
}

// Under Cache Components call `io()` first (settings cache reads the clock).
export async function checkOfficeAccess(headers: Headers): Promise<OfficeAccessResult> {
  const settings = await getAppSettings();
  if (!settings.officeIpCheck) return { allowed: true };
  return matchOfficeAllowlist(headers, settings);
}

// Client IP is on the office allowlist (even when the office check is off): exempt from public per-IP limits.
export async function isOfficeIp(headers: Headers): Promise<boolean> {
  return matchOfficeAllowlist(headers, await getAppSettings()).allowed;
}

function matchOfficeAllowlist(
  headers: Headers,
  settings: { officeAllowedIps: string; trustedIpHeader: string },
): OfficeAccessResult {
  const rules = getAllowlist(settings.officeAllowedIps);
  if (!rules) return { allowed: false, reason: 'invalid-config' };
  if (rules.length === 0) return { allowed: false, reason: 'not-configured' };
  if (!settings.trustedIpHeader) return { allowed: false, reason: 'invalid-header-name' };

  const ip = extractClientIp(headers.get(settings.trustedIpHeader));
  if (!ip) return { allowed: false, reason: 'missing-ip' };

  return isIpAllowed(ip, rules) ? { allowed: true } : { allowed: false, reason: 'not-allowed' };
}

// Rate-limit key from the trusted header: IPv4 per address, IPv6 per /64; null = unknown.
export async function getClientIpKey(headers: Headers): Promise<string | null> {
  const { trustedIpHeader } = await getAppSettings();
  if (!trustedIpHeader) return null;
  const ip = extractClientIp(headers.get(trustedIpHeader));
  if (!ip) return null;
  const value = ip.version === 6 ? ip.value >> BigInt(64) : ip.value;
  return `${ip.version}:${value.toString(16)}`;
}
