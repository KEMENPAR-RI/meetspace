import { headers } from 'next/headers';

// `Secure` cookies are dropped by browsers on plain http, which silently logs users out. Server-only.
// Order: the real protocol from the reverse proxy (x-forwarded-proto), then APP_URL, then NODE_ENV.
export async function shouldUseSecureCookie(): Promise<boolean> {
  const forwarded = (await headers()).get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwarded === 'https') return true;
  if (forwarded === 'http') return false;

  const appUrl = process.env.APP_URL?.trim().toLowerCase();
  if (appUrl?.startsWith('https://')) return true;
  if (appUrl?.startsWith('http://')) return false;

  return process.env.NODE_ENV === 'production';
}
