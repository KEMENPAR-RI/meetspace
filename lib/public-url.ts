// APP_URL (http/https origin, no path/query) for QR codes and copy-link (J5).
// Never falls back to the Host header or localhost.

let cache: { raw: string | undefined; value: string | null } | undefined;

export function getPublicBaseUrl(): string | null {
  const raw = process.env.APP_URL;
  if (cache && cache.raw === raw) return cache.value;
  let value: string | null = null;
  try {
    const url = new URL((raw ?? '').trim());
    const plain = !url.username && !url.password && !url.search && !url.hash && (url.pathname === '/' || url.pathname === '');
    if ((url.protocol === 'https:' || url.protocol === 'http:') && plain) value = url.origin;
  } catch {
    value = null;
  }
  if (!value && raw?.trim()) console.error('[public-url] invalid APP_URL');
  cache = { raw, value };
  return value;
}

// `path` must start with "/"; null when APP_URL is not configured.
export function publicUrl(path: string): string | null {
  const base = getPublicBaseUrl();
  return base ? `${base}${path}` : null;
}

export function roomBookingUrl(roomId: string): string | null {
  return publicUrl(`/ruang/${encodeURIComponent(roomId)}`);
}

export const PUBLIC_URL_MISSING = 'URL publik belum dikonfigurasi.';
