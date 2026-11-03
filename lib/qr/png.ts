import { deflateSync } from 'node:zlib';

import qrcode from 'qrcode-generator';

// QR matrix (qrcode-generator) -> 8-bit grayscale PNG, no extra deps.

export const QUIET_ZONE = 4;
const TARGET_PX = 1024;
const MIN_PX = 512;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export type QrMatrix = { count: number; isDark: (row: number, col: number) => boolean };

// ECC H (30% recovery) so a centered logo stays scannable; byte mode, auto version.
export function makeQrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, 'H');
  qr.addData(text, 'Byte');
  qr.make();
  return { count: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) };
}

// Output is >= 512 px square (J3); no logo (raster decoding would need a package).
export function renderQrPng(text: string): Uint8Array<ArrayBuffer> {
  const qr = makeQrMatrix(text);
  const count = qr.count;
  const modules = count + QUIET_ZONE * 2;
  const scale = Math.max(Math.floor(TARGET_PX / modules), Math.ceil(MIN_PX / modules));
  const size = modules * scale;

  // Each scanline: filter byte 0 + one gray byte per pixel (0 = dark, 255 = light).
  const stride = size + 1;
  const raw = Buffer.alloc(stride * size, 255);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    const row = Math.floor(y / scale) - QUIET_ZONE;
    if (row < 0 || row >= count) continue;
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      const start = y * stride + 1 + (col + QUIET_ZONE) * scale;
      raw.fill(0, start, start + scale);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return new Uint8Array(png);
}
