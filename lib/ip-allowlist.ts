// Pure client-IP parsing; no Next.js or Node imports so it runs anywhere.

export type IpVersion = 4 | 6;
export type ParsedIp = { version: IpVersion; value: bigint };

// BigInt() instead of literals: tsconfig targets ES2017.
const ZERO = BigInt(0);
const V4_MAPPED_PREFIX = BigInt(0xffff);
const V4_MAX = BigInt(0xffffffff);

const MAX_CLIENT_IP_LENGTH = 64;

const V4_OCTET = /^(0|[1-9]\d{0,2})$/;
const V6_GROUP = /^[0-9a-f]{1,4}$/;
const PORT = /^\d{1,5}$/;

function parseV4(input: string): bigint | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;

  let value = ZERO;
  for (const part of parts) {
    if (!V4_OCTET.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << BigInt(8)) | BigInt(octet);
  }
  return value;
}

function parseGroups(side: string): string[] | null {
  if (side === '') return [];
  const groups = side.split(':');
  return groups.every((g) => V6_GROUP.test(g)) ? groups : null;
}

function parseV6(input: string): bigint | null {
  let text = input.toLowerCase();

  // Embedded IPv4 tail (e.g. ::ffff:1.2.3.4) becomes two hex groups.
  if (text.includes('.')) {
    const lastColon = text.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4 = parseV4(text.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = Number(v4 >> BigInt(16)).toString(16);
    const lo = Number(v4 & BigInt(0xffff)).toString(16);
    text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const head = parseGroups(halves[0]);
  const tail = halves.length === 2 ? parseGroups(halves[1]) : [];
  if (!head || !tail) return null;

  const count = head.length + tail.length;
  if (halves.length === 2 ? count > 7 : count !== 8) return null;

  const groups = [...head, ...Array<string>(8 - count).fill('0'), ...tail];
  let value = ZERO;
  for (const group of groups) value = (value << BigInt(16)) | BigInt(parseInt(group, 16));
  return value;
}

// Parses without ::ffff: normalisation.
function parseRawIp(input: string): ParsedIp | null {
  if (input.includes(':')) {
    const value = parseV6(input);
    return value === null ? null : { version: 6, value };
  }
  const value = parseV4(input);
  return value === null ? null : { version: 4, value };
}

function isV4Mapped(ip: ParsedIp): boolean {
  return ip.version === 6 && ip.value >> BigInt(32) === V4_MAPPED_PREFIX;
}

// Bare address only (no port, brackets or zone); ::ffff:a.b.c.d is returned as IPv4.
export function parseIp(input: string): ParsedIp | null {
  const ip = parseRawIp(input);
  if (!ip) return null;
  return isV4Mapped(ip) ? { version: 4, value: ip.value & V4_MAX } : ip;
}

// Rightmost entry is the one set by the nearest trusted proxy.
export function extractClientIp(headerValue: string | null): ParsedIp | null {
  if (!headerValue) return null;

  const entries = headerValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  let text = entries[entries.length - 1];
  if (!text || text.length > MAX_CLIENT_IP_LENGTH) return null;

  if (text.startsWith('[')) {
    const close = text.indexOf(']');
    if (close === -1) return null;
    const rest = text.slice(close + 1);
    if (rest && !(rest.startsWith(':') && PORT.test(rest.slice(1)))) return null;
    text = text.slice(1, close);
  } else if (text.split(':').length === 2) {
    // A single colon can only be v4:port.
    const [host, port] = text.split(':');
    if (!PORT.test(port)) return null;
    text = host;
  }

  const zone = text.indexOf('%');
  if (zone !== -1 && text.includes(':')) text = text.slice(0, zone);

  return parseIp(text);
}
