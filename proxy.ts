import { NextResponse, type NextRequest } from 'next/server';

import { resolveLoginIpKey } from '@/lib/auth/login-rate-limit';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { findSessionUser } from '@/lib/auth/session-store';
import { TOO_MANY_HTML } from '@/lib/forbidden-html';
import { getClientIpKey } from '@/lib/office-access';
import { consumePublicPageQuota } from '@/lib/public-rate-limit';
import { isPublicPath } from '@/lib/public-paths';
import { getAppSettings } from '@/lib/settings/queries';

const PAGE_METHODS = new Set(['GET', 'HEAD']);
const LOGO_PATH = '/api/logo';

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex',
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isPublicPath(pathname) || !countsAsPageView(request, pathname)) return NextResponse.next();
  const retryAfterS = await publicPageRetryAfter(request);
  if (retryAfterS === null) return NextResponse.next();
  return new Response(TOO_MANY_HTML, {
    status: 429,
    headers: { ...HTML_HEADERS, 'retry-after': String(retryAfterS) },
  });
}

// GET/HEAD always; on pages also a plain POST (rendered like a GET). Server Actions (`next-action`) are limited
// inside the action; /api/logo stays GET/HEAD only (its route rejects POST).
function countsAsPageView(request: NextRequest, pathname: string): boolean {
  if (PAGE_METHODS.has(request.method)) return true;
  return pathname !== LOGO_PATH && !request.headers.has('next-action');
}

// Per-IP limit for public GET pages; null = allowed, else Retry-After seconds.
// Over the limit, a valid session still passes (checked only then: no DB per view).
async function publicPageRetryAfter(request: NextRequest): Promise<number | null> {
  let settings;
  try {
    settings = await getAppSettings();
  } catch (error) {
    // Settings unavailable: the page fails on its own DB reads; the in-memory limiter needs the header setting.
    console.error('[proxy] public page limit skipped: settings unavailable', error);
    return null;
  }
  const windowS = settings.publicPageRateWindowMin * 60;

  const ipKey = resolveLoginIpKey(await getClientIpKey(request.headers));
  const allowed =
    ipKey !== null &&
    consumePublicPageQuota(ipKey, { max: settings.publicPageRateMax, windowMin: settings.publicPageRateWindowMin });
  if (allowed || (await hasValidSession(request))) return null;
  return windowS;
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    return (await findSessionUser(token, new Date())) !== null;
  } catch (error) {
    console.error('[proxy] session check failed', error);
    return false;
  }
}

export const config = {
  // Only the rate-limited pages (see lib/public-paths.ts); everything else skips the proxy.
  matcher: ['/', '/ruang/:id', '/api/logo'],
};
