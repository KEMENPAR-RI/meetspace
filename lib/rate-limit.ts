import { prisma } from '@/lib/prisma';
import { getAppSettings } from '@/lib/settings/queries';

// Rows are dead once their window ends; keep a small margin.
const RETENTION_MARGIN_MS = 60_000;
// Roughly 1 in N requests prunes old rows.
const CLEANUP_EVERY = 20;
const MINUTE_MS = 60_000;

export type PublicQuotaResult = { ok: true } | { ok: false; retryAfterMin: number };

export function rateLimitMessage(retryAfterMin: number): string {
  return `Terlalu banyak percobaan, coba lagi dalam ${retryAfterMin} menit.`;
}

// Public mutations (attendance + booking) share one fixed window per IP key, across rooms.
// Limits from app_settings (public_mutation_rate_*). Fails closed on DB errors.
export async function consumePublicMutationQuota(ipKey: string, now: Date): Promise<PublicQuotaResult> {
  let windowMs = 0;
  try {
    const settings = await getAppSettings();
    const max = settings.publicMutationRateMax;
    windowMs = settings.publicMutationRateWindowMin * MINUTE_MS;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

    const [, row] = await prisma.$transaction([
      prisma.$executeRaw`INSERT INTO attendance_rate_limits (ip_key, window_start, hits)
        VALUES (${ipKey}, ${windowStart}, 1)
        ON DUPLICATE KEY UPDATE hits = hits + 1`,
      prisma.attendanceRateLimit.findUnique({
        where: { ipKey_windowStart: { ipKey, windowStart } },
        select: { hits: true },
      }),
    ]);
    // Awaited: fire-and-forget may be cut off on serverless.
    if (Math.random() * CLEANUP_EVERY < 1) await pruneOldWindows(now, windowMs);
    if (row !== null && row.hits <= max) return { ok: true };
    const leftMs = windowStart.getTime() + windowMs - now.getTime();
    return { ok: false, retryAfterMin: Math.max(1, Math.ceil(leftMs / MINUTE_MS)) };
  } catch (error) {
    console.error('[rate-limit] failed to record hit', error);
    return { ok: false, retryAfterMin: Math.max(1, Math.ceil(windowMs / MINUTE_MS)) };
  }
}

// Total attendees cap for public submits (app_settings); true = full. Fails closed on DB errors.
export async function isBookingAttendanceFull(bookingId: string): Promise<boolean> {
  try {
    const max = (await getAppSettings()).publicAttendanceMaxPerBooking;
    const found = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { _count: { select: { attendances: true } } },
    });
    return !found || found._count.attendances >= max;
  } catch (error) {
    console.error('[rate-limit] failed to count attendees', error);
    return true;
  }
}

async function pruneOldWindows(now: Date, windowMs: number): Promise<void> {
  const cutoff = new Date(now.getTime() - windowMs - RETENTION_MARGIN_MS);
  try {
    await prisma.$executeRaw`DELETE FROM attendance_rate_limits WHERE window_start < ${cutoff} LIMIT 100`;
  } catch (error) {
    console.error('[rate-limit] cleanup failed', error);
  }
}
