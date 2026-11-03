import { getLogo } from '@/lib/settings/logo';

import { renderQrPng } from './png';
import { renderQrSvg } from './svg';

const NO_STORE = { 'cache-control': 'private, no-store' };

export function qrJsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

// Blocks cross-site embeds/navigations; clients without the header pass.
export function isCrossSite(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  return Boolean(fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none');
}

// `?format=svg` -> SVG with the app logo in the middle (ECC H); default PNG without logo.
// `?download=1` -> attachment. `fileBase` must be ASCII-safe (roomFileLabel/date only).
export async function qrResponse(request: Request, url: string, fileBase: string): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const disposition = params.get('download') === '1' ? 'attachment' : 'inline';
  const common = { ...NO_STORE, 'x-content-type-options': 'nosniff' };

  if (params.get('format') === 'svg') {
    const logo = await getLogo();
    return new Response(renderQrSvg(url, logo), {
      headers: {
        ...common,
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-disposition': `${disposition}; filename="${fileBase}.svg"`,
        // Opened directly, the SVG can only show its own embedded image.
        'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      },
    });
  }

  return new Response(renderQrPng(url), {
    headers: {
      ...common,
      'content-type': 'image/png',
      'content-disposition': `${disposition}; filename="${fileBase}.png"`,
    },
  });
}
