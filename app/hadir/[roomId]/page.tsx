import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { io } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/access';
import { getDeviceLockRemainingMin, readDeviceKey } from '@/lib/booking/device-lock';
import { loadRoomAttendance } from '@/lib/booking/public-attendance';
import { getRecaptchaSiteKey } from '@/lib/settings/recaptcha';
import { PublicHeader } from '../../_components/public-header';
import {
  NoMeetingNotice,
  PublicAttendanceSkeleton,
  PublicAttendanceView,
  PublicNotice,
} from '../../_components/public-attendance-view';

export const metadata: Metadata = {
  title: 'Daftar Hadir Rapat',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = Promise<{ roomId: string }>;

// Per-room QR landing (sticker on the door); the open meeting is resolved per request.
export default function HadirRoomPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 font-sans sm:py-10">
      <PublicHeader />
      <Suspense fallback={<PublicAttendanceSkeleton />}>
        <HadirRoom params={params} />
      </Suspense>
    </main>
  );
}

async function HadirRoom({ params }: { params: Params }) {
  const { roomId } = await params;
  // Must precede DB queries and `new Date()` under Cache Components.
  await io();
  const now = new Date();
  const result = await loadRoomAttendance(roomId, now);
  if (!result) notFound();

  if (result.state === 'open') {
    const [recaptchaSiteKey, deviceLockedMin] = await Promise.all([getRecaptchaSiteKey(), deviceLockFor(now)]);
    return (
      <PublicAttendanceView
        meeting={result.meeting}
        roomId={result.room.id}
        now={now}
        recaptchaSiteKey={recaptchaSiteKey}
        deviceLockedMin={deviceLockedMin}
      />
    );
  }
  if (result.state === 'inactive') {
    return (
      <PublicNotice title="Ruangan tidak tersedia">
        <p>{result.room.name} sedang tidak digunakan untuk rapat.</p>
      </PublicNotice>
    );
  }
  return <NoMeetingNotice roomName={result.room.name} next={result.nextBooking} />;
}

// Signed-in staff are never locked (kiosk use). Read-only: the cookie is set by the action, not here.
async function deviceLockFor(now: Date): Promise<number | null> {
  if (await getCurrentUser()) return null;
  const { key } = await readDeviceKey();
  if (!key) return null;
  // Display only; the action re-checks atomically, so a DB error just shows the form.
  return getDeviceLockRemainingMin(key, now).catch(() => null);
}
