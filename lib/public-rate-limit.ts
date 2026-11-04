import { FixedWindow } from '@/lib/auth/login-rate-limit';

// Public pages (/, /ruang/[id], /api/logo) per IP key, in memory (per instance, reset on restart):
// a DB write per page view is too heavy for the 1GB VPS. Mutations use the DB limiter in lib/rate-limit.ts.
const byIp = new FixedWindow();

export type PublicPageLimits = { max: number; windowMin: number };

// true = allowed.
export function consumePublicPageQuota(ipKey: string, limits: PublicPageLimits, nowMs: number = Date.now()): boolean {
  return byIp.consume(ipKey, limits.max, limits.windowMin * 60_000, nowMs);
}

// Tests only.
export const publicRateLimitForTests = {
  size: () => byIp.size,
  clear: () => byIp.clear(),
};
