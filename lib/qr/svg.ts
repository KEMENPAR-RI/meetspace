import { makeQrMatrix, QUIET_ZONE } from './png';

// QR as SVG (ECC H) with an optional centered logo on a white plate.
// The plate covers <= ~30% of the code width (~9% of its area), well inside H's 30% recovery.

const SIZE_PX = 1024;
// Logo box (incl. padding) as a fraction of the module width of the code.
const LOGO_BOX = 0.3;
const LOGO_PADDING = 0.1;

export type QrLogo = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; data: Uint8Array };

export function renderQrSvg(text: string, logo?: QrLogo | null): string {
  const qr = makeQrMatrix(text);
  const { count } = qr;
  const total = count + QUIET_ZONE * 2;

  // Modules hidden behind the plate are skipped so the plate is clean.
  const box = logo ? Math.floor(count * LOGO_BOX) | 1 : 0; // odd -> centered on the module grid
  const boxStart = Math.floor((count - box) / 2);
  const covered = (r: number, c: number) =>
    box > 0 && r >= boxStart && r < boxStart + box && c >= boxStart && c < boxStart + box;

  let path = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c) && !covered(r, c)) path += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`;
    }
  }

  let logoMarkup = '';
  if (logo) {
    const x = boxStart + QUIET_ZONE;
    const pad = box * LOGO_PADDING;
    const href = `data:${logo.mime};base64,${Buffer.from(logo.data).toString('base64')}`;
    logoMarkup =
      `<rect x="${x}" y="${x}" width="${box}" height="${box}" rx="${(box * 0.12).toFixed(2)}" fill="#fff"/>` +
      `<image x="${x + pad}" y="${x + pad}" width="${box - pad * 2}" height="${box - pad * 2}" ` +
      `preserveAspectRatio="xMidYMid meet" href="${href}"/>`;
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE_PX}" height="${SIZE_PX}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/>` +
    logoMarkup +
    `</svg>`
  );
}
