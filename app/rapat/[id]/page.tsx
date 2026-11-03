import { Suspense } from 'react';
import type { Metadata } from 'next';
import { io } from 'next/cache';
import { signAttendance } from '@/app/actions/attendance';
import {
  ATTENDANCE_CLOSE_AFTER_MS,
  ATTENDANCE_OPEN_BEFORE_MS,
  isAttendanceOpen,
} from '@/lib/booking/attendance-window';
import { ensureAttendanceToken } from '@/lib/booking/attendance-token';
import { isAdmin } from '@/lib/auth/session';
import { getBookingAttendance } from '@/lib/booking/queries';
import type { Attendee } from '@/lib/booking/types';
import { formatDateLabel, formatTime, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { isBookingId } from '@/lib/booking/validation';
import { AttendanceForm } from '../../_components/attendance-form';
import { AttendeeList } from '../../_components/attendee-list';
import { BackLink } from '../../_components/back-link';
import { CopyAttendanceLink } from '../../_components/copy-attendance-link';
import { ExportButtons } from '../../_components/export-buttons';
import { SiteHeader } from '../../_components/site-header';
import { StatusBadge } from '../../_components/status-badge';

export const metadata: Metadata = { title: 'Daftar Hadir - MeetSpace' };

type Params = Promise<{ id: string }>;

// Static shell; params + cookie are read inside Suspense (Cache Components).
export default function AttendancePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 font-sans sm:px-6 lg:py-14">
      <SiteHeader />
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
        <BackLink href="/">Kembali ke booking</BackLink>
      </div>
      <Suspense fallback={<AttendanceSkeleton />}>
        <AttendanceContent params={params} />
      </Suspense>
    </main>
  );
}

async function AttendanceContent({ params }: { params: Params }) {
  const { id } = await params;
  if (!isBookingId(id)) return <NotFoundCard />;

  // Must precede DB queries (mariadb pool calls Date.now()) and `new Date()` under Cache Components.
  await io();
  const [admin, data] = await Promise.all([isAdmin(), getBookingAttendance(id)]);
  if (!data) return <NotFoundCard />;

  const { booking } = data;
  const token = booking.attendanceToken ?? (await ensureAttendanceToken(booking.id));
  const now = new Date();
  const open = isAttendanceOpen(booking.startsAt, booking.endsAt, now);
  const attendees: Attendee[] = data.attendees.map((a) => ({
    id: a.id,
    name: a.name,
    division: a.division,
    role: a.role,
    // Phone never reaches non-admin RSC payloads.
    phone: admin ? a.phone : null,
    signedAtISO: a.signedAt.toISOString(),
    signedAtLabel: `${formatDateLabel(a.signedAt)}, ${formatTime(a.signedAt)} WIB`,
  }));

  return (
    <div className="space-y-8">
      {/* Booking summary */}
      <section
        aria-labelledby="meeting-heading"
        className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 shadow-sm sm:p-6"
      >
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Daftar Hadir Rapat</p>
        <h2 id="meeting-heading" className="mt-1 text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          <time dateTime={booking.startsAt.toISOString()}>{formatDateLabel(booking.startsAt)}</time>
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="font-medium tabular-nums text-zinc-700">
            {formatTimeRange(booking.startsAt, booking.endsAt)}
          </span>
          <StatusBadge
            startsAt={booking.startsAt.toISOString()}
            endsAt={booking.endsAt.toISOString()}
            initialStatus={getBookingStatus(booking.startsAt, booking.endsAt, now)}
          />
          {/* Snapshot at request time, same as the form below */}
          <span className={`text-xs font-medium ${open ? 'text-emerald-700' : 'text-zinc-500'}`}>
            {open ? 'Daftar hadir dibuka' : 'Daftar hadir ditutup'}
          </span>
        </div>
        <p className="mt-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{booking.bookerName}</span>
          <span aria-hidden="true"> · </span>
          {booking.division}
        </p>
        {/* Plain text only; line breaks kept via CSS */}
        <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-700">{booking.agenda}</p>
        {(token || admin) && (
          <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-zinc-100 pt-4">
            {token && <CopyAttendanceLink key={token} path={`/hadir/${token}`} />}
            {/* Admin-only, rendered server-side */}
            {admin && (
              <div className="sm:ml-auto">
                <ExportButtons
                  endpoint={`/api/rapat/${booking.id}/export`}
                  searchParams=""
                  label="Ekspor daftar hadir rapat ini"
                />
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        {/* Focal point: the sign form */}
        <section
          aria-labelledby="sign-heading"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-8"
        >
          <h2 id="sign-heading" className="mb-5 text-lg font-semibold text-primary">
            Isi Daftar Hadir
          </h2>
          {/* Non-admins sign via /hadir; the action re-checks admin */}
          {!admin ? (
            <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-600">
              Pengisian daftar hadir melalui halaman{' '}
              <span className="font-semibold text-primary">/hadir</span> (scan QR di ruang rapat).
            </p>
          ) : open ? (
            <AttendanceForm action={signAttendance.bind(null, booking.id)} variant="internal" />
          ) : (
            <ClosedNotice startsAt={booking.startsAt} endsAt={booking.endsAt} now={now} />
          )}
        </section>

        <AttendeeList attendees={attendees} admin={admin} />
      </div>
    </div>
  );
}

function ClosedNotice({ startsAt, endsAt, now }: { startsAt: Date; endsAt: Date; now: Date }) {
  const opensAt = new Date(startsAt.getTime() - ATTENDANCE_OPEN_BEFORE_MS);
  const closesAt = new Date(endsAt.getTime() + ATTENDANCE_CLOSE_AFTER_MS);
  return (
    <div role="status" className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-primary">
        {now < opensAt ? 'Daftar hadir belum dibuka' : 'Daftar hadir sudah ditutup'}
      </p>
      <p className="mt-1 text-sm tabular-nums text-zinc-600">
        Dibuka {formatTimeRange(opensAt, closesAt)}
      </p>
    </div>
  );
}

function NotFoundCard() {
  return (
    <section
      aria-labelledby="missing-heading"
      className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8"
    >
      <h2 id="missing-heading" className="text-lg font-semibold text-primary">
        Rapat tidak ditemukan
      </h2>
      <p className="mt-2 text-sm text-pretty text-zinc-600">
        Rapat tidak ditemukan atau sudah dibatalkan.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
        <BackLink href="/rapat">Lihat rapat sebelumnya</BackLink>
      </div>
    </section>
  );
}

function AttendanceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat daftar hadir" className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 motion-safe:animate-pulse sm:p-6">
        <div className="h-3 w-32 rounded bg-zinc-200" />
        <div className="mt-3 h-6 w-64 max-w-full rounded bg-zinc-200" />
        <div className="mt-3 h-3 w-28 rounded bg-zinc-200" />
        <div className="mt-4 h-3 w-full rounded bg-zinc-100" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="h-96 rounded-2xl border border-zinc-200 bg-white motion-safe:animate-pulse" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-zinc-200 bg-white motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
