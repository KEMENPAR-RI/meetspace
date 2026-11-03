import { APPEARANCE_LIMITS, type LogoMime } from './types';

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

// Magic bytes only (never the client's mime): PNG, JPEG, WebP; null otherwise.
export function sniffLogoMime(bytes: Uint8Array): LogoMime | null {
  if (bytes.length < 12 || bytes.length > APPEARANCE_LIMITS.logoMaxBytes) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  // "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}
