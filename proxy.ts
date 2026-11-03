import { NextResponse, type NextRequest } from 'next/server';

import { resolveLoginIpKey } from '@/lib/auth/login-rate-limit';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { findSessionUser } from '@/lib/auth/session-store';
import { FORBIDDEN_HTML, TOO_MANY_HTML } from '@/lib/forbidden-html';
import { checkOfficeAccess, getClientIpKey, isOfficeIp } from '@/lib/office-access';
import { consumePublicPageQuota } from '@/lib/public-rate-limit';
import { isDashboardPath, isPublicAttendancePath } from '@/lib/public-paths';
import { getAppSettings } from '@/lib/settings/queries';

const PUBLIC_METHODS = new Set(['GET', 'HEAD', 'POST']);
const PAGE_METHODS = new Set(['GET', 'HEAD']);

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex',
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // POST is needed for Server Actions; public actions re-check office access, dashboard ones check the session/role.
  if (isPublicAttendancePath(pathname) && PUBLIC_METHODS.has(request.method)) {
    // Mutations (POST) are rate limited inside the actions.
    if (PAGE_METHODS.has(request.method)) {
      const retryAfterS = await publicPageRetryAfter(request);
      if (retryAfterS !== null) {
        return new Response(TOO_MANY_HTML, {
          status: 429,
          headers: { ...HTML_HEADERS, 'retry-after': String(retryAfterS) },
        });
      }
    }
    return NextResponse.next();
  }
  if (isDashboardPath(pathname) && PUBLIC_METHODS.has(request.method)) return NextResponse.next();
  if ((await checkOfficeAccess(request.headers)).allowed) return NextResponse.next();

  // Direct 403 body: no /forbidden route, so no redirect loop and no 200 for outsiders.
  return new Response(FORBIDDEN_HTML, { status: 403, headers: HTML_HEADERS });
}

// Per-IP limit for public GET pages; null = allowed, else Retry-After seconds.
// Office allowlist IPs are exempt; over the limit, a valid session still passes (checked only then: no DB per view).
async function publicPageRetryAfter(request: NextRequest): Promise<number | null> {
  let settings;
  try {
    settings = await getAppSettings();
    if (await isOfficeIp(request.headers)) return null;
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
  matcher: ['/((?!_next/static/|images/).*)'],
};
