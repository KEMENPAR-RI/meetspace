// In-memory fixed windows (single app instance); bounds guessing and scrypt load on the 1GB VPS.
// Login buckets: per IP (loose: an office shares one IP), per username|IP (strict), and per username
// across all IPs (10x strict, against distributed guessing; skipped for allowlisted office IPs).

// Hard cap on tracked keys per bucket.
const MAX_KEYS = 5000;
// Global per-username bucket = this many times loginRateMax.
const GLOBAL_USER_FACTOR = 10;

type Entry = { hits: number; resetAt: number; max: number };

// From app_settings (lib/settings): login_rate_max, login_ip_rate_max, login_rate_window_min.
export type LoginLimits = { userMax: number; ipMax: number; windowMin: number };

export class FixedWindow {
  private readonly entries = new Map<string, Entry>();

  // Counts the attempt; true = still within the limit. A new key is refused when the map is full of locked entries.
  consume(key: string, max: number, windowMs: number, nowMs: number): boolean {
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= nowMs) {
      if (entry) this.entries.delete(key);
      else if (this.entries.size >= MAX_KEYS && !this.makeRoom(nowMs)) return false;
      this.entries.set(key, { hits: 1, resetAt: nowMs + windowMs, max });
      return true;
    }
    entry.hits++;
    entry.max = max;
    return entry.hits <= max;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  // Expired entries first, then the oldest one that is not locked; locked entries are never evicted.
  private makeRoom(nowMs: number): boolean {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= nowMs) this.entries.delete(key);
    }
    if (this.entries.size < MAX_KEYS) return true;
    // Map keeps insertion order: the first unlocked entry is the oldest.
    for (const [key, entry] of this.entries) {
      if (entry.hits < entry.max) {
        this.entries.delete(key);
        return true;
      }
    }
    return false;
  }
}

const byIp = new FixedWindow();
// Unknown usernames are counted too, so the limiter never reveals which accounts exist.
const byUserIp = new FixedWindow();
const byUser = new FixedWindow();
const byPasswordChange = new FixedWindow();

const userIpKey = (username: string, ipKey: string) => `${username}|${ipKey}`;

// Fixed key for local `next dev` without a reverse proxy (no client IP header); still rate limited.
export const DEV_LOCAL_IP_KEY = 'dev-local';

// Unknown client IP: refused (null) in production, mapped to DEV_LOCAL_IP_KEY elsewhere.
export function resolveLoginIpKey(ipKey: string | null, nodeEnv: string | undefined = process.env.NODE_ENV): string | null {
  if (ipKey) return ipKey;
  return nodeEnv === 'production' ? null : DEV_LOCAL_IP_KEY;
}

// Login: false when any bucket is full. `username` lowercase; `ipKey` from getClientIpKey (never a shared "unknown").
// `office` = IP matched the active office allowlist: exempt from the global per-username bucket.
export function consumeLoginAttempt(
  ipKey: string,
  username: string,
  limits: LoginLimits,
  { office = false }: { office?: boolean } = {},
  nowMs: number = Date.now(),
): boolean {
  const windowMs = limits.windowMin * 60_000;
  if (!byIp.consume(ipKey, limits.ipMax, windowMs, nowMs)) return false;
  if (!byUserIp.consume(userIpKey(username, ipKey), limits.userMax, windowMs, nowMs)) return false;
  if (office) return true;
  return byUser.consume(username, limits.userMax * GLOBAL_USER_FACTOR, windowMs, nowMs);
}

// Successful login clears only that username|IP bucket; the IP and global buckets keep counting.
export function resetUserLoginAttempts(username: string, ipKey: string): void {
  byUserIp.reset(userIpKey(username, ipKey));
}

// Change-own-password (two scrypt runs per attempt), per user id.
export function consumePasswordChangeAttempt(userId: string, limits: LoginLimits, nowMs: number = Date.now()): boolean {
  return byPasswordChange.consume(userId, limits.userMax, limits.windowMin * 60_000, nowMs);
}

export function resetPasswordChangeAttempts(userId: string): void {
  byPasswordChange.reset(userId);
}

// Tests only.
export const loginRateLimitForTests = {
  sizes: () => ({ ip: byIp.size, userIp: byUserIp.size, user: byUser.size, passwordChange: byPasswordChange.size }),
  maxKeys: MAX_KEYS,
  globalUserFactor: GLOBAL_USER_FACTOR,
  clear: () => {
    byIp.clear();
    byUserIp.clear();
    byUser.clear();
    byPasswordChange.clear();
  },
};
