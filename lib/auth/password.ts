import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Pure helpers (Node crypto only); format: scrypt$<N>$<r>$<p>$<saltB64url>$<hashB64url>.

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
// 128 * N * r = 32 MiB per hash; headroom for the 1GB VPS.
const MAX_MEM = 64 * 1024 * 1024;
// Bounds for params read back from the DB.
const MAX_N = 2 ** 17;
const MAX_R = 16;
const MAX_P = 4;
// Concurrent scrypt runs (each ~32 MiB); extra callers queue, beyond the queue they fail fast.
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 16;

// Random-password hash with current params: unknown usernames verify against it (same timing).
export const DUMMY_HASH =
  'scrypt$32768$8$1$ksq3d4mp8DPdSVlRIfDpEw$8qfSOuYDtuu8YeLRXmkOec-rHKjdAY7PP9QZYbTtKMxA6hsu3x50vut3IEa_Tu1H5RXNWub6-3iPFnoOUXC0Xg';

export class PasswordHasherBusyError extends Error {
  constructor() {
    super('password hasher busy');
  }
}

type ParsedHash = { n: number; r: number; p: number; salt: Buffer; hash: Buffer };

let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) {
    if (waiting.length >= MAX_QUEUED) throw new PasswordHasherBusyError();
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

function derive(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return withSlot(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password.normalize('NFC'), salt, keylen, { ...options, maxmem: MAX_MEM }, (err, key) =>
          err ? reject(err) : resolve(key),
        );
      }),
  );
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every(Number.isInteger)) return null;
  if (n < 2 || n > MAX_N || (n & (n - 1)) !== 0 || r < 1 || r > MAX_R || p < 1 || p > MAX_P) return null;
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  if (salt.length < 8 || hash.length < 32) return null;
  return { n, r, p, salt, hash };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

// Always runs one scrypt (dummy on malformed input) so timing does not reveal why it failed.
export async function verifyPassword(password: unknown, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  const target = parsed ?? (parseHash(DUMMY_HASH) as ParsedHash);
  const input = typeof password === 'string' ? password : '';
  const key = await derive(input, target.salt, target.hash.length, { N: target.n, r: target.r, p: target.p });
  return parsed !== null && typeof password === 'string' && timingSafeEqual(key, target.hash);
}

// True when the stored hash uses older params than the current ones.
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  return !parsed || parsed.n !== N || parsed.r !== R || parsed.p !== P || parsed.hash.length !== KEY_LENGTH;
}
