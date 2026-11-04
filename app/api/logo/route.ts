import type { NextRequest } from 'next/server';

import { getLogo } from '@/lib/settings/logo';

// GET /api/logo[?v=<logoUpdatedAt ms>]: public (also for the dashboard login page); rate limited per IP in proxy.ts.
// Versioned URLs are immutable; unversioned ones revalidate via ETag.
export async function GET(request: NextRequest): Promise<Response> {
  const logo = await getLogo();
  if (!logo) {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
  }

  const version = String(logo.updatedAt.getTime());
  const etag = `"logo-${version}"`;
  const versioned = request.nextUrl.searchParams.get('v') === version;
  const headers = {
    etag,
    'cache-control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff',
  };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  return new Response(new Uint8Array(logo.data), {
    headers: { ...headers, 'content-type': logo.mime, 'content-length': String(logo.data.length) },
  });
}
