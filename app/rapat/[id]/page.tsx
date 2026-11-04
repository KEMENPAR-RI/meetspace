import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { io } from 'next/cache';
import { CalendarX2, Clock, DoorOpen, Lock, LockOpen, PenLine } from 'lucide-react';
import { isAttendanceOpen } from '@/lib/booking/attendance-window';
import { getBookingAttendance } from '@/lib/booking/queries';
import type { Attendee } from '@/lib/booking/types';
import { formatDateLabel, formatTime, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { isBookingId } from '@/lib/booking/validation';
import { AttendeeList } from '../../_components/attendee-list';
import { BackLink } from '../../_components/back-link';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';
import { StatusBadge } from '../../_components/status-badge';

export const metadata: Metadata = { title: 'Daftar Hadir' };

type Params = Promise<{ id: string }>;

// Public, read-only (I1): no admin actions, export, copy link, or phone numbers.
export default function AttendancePage({ params }: { params: Params }) {
  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 font-sans sm:px-6 lg:py-14">
        <SiteHeader />
        <Suspense fallback={<AttendanceSkeleton />}>
          <AttendanceContent params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function AttendanceContent({ params }: { params: Params }) {
  const { id } = await params;
  if (!isBookingId(id)) return <NotFoundCard />;

  // Must precede DB queries (mariadb pool calls Date.now()) and `new Date()` under Cache Components.
  await io();
  const data = await getBookingAttendance(id);
  if (!data) return <NotFoundCard />;

  const { booking } = data;
  const now = new Date();
  const open = isAttendanceOpen(booking.startsAt, booking.endsAt, now);
  const attendees = data.attendees.map((a) => ({
    id: a.id,
    name: a.name,
    satker: a.satker,
    role: a.role,
    gender: a.gender,
    // Phone never reaches public RSC payloads (H5).
    phone: null,
    signedAtISO: a.signedAt.toISOString(),
    signedAtLabel: `${formatDateLabel(a.signedAt)}, ${formatTime(a.signedAt)} WIB`,
  })) satisfies Attendee[];

  return (
    <div className="space-y-8">
      <BackLink href={`/ruang/${booking.room.id}`}>Kembali ke {booking.room.name}</BackLink>

      <section
        aria-labelledby="meeting-heading"
        className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 shadow-sm sm:p-6"
      >
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <DoorOpen className="size-4 shrink-0" />
          Daftar Hadir Rapat · <span className="normal-case">{booking.room.name}</span>
        </p>
        <h2 id="meeting-heading" className="mt-1 text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          <time dateTime={booking.startsAt.toISOString()}>{formatDateLabel(booking.startsAt)}</time>
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-zinc-700">
            <Clock className="size-4 text-zinc-400" />
            {formatTimeRange(booking.startsAt, booking.endsAt)}
          </span>
          <StatusBadge
            startsAt={booking.startsAt.toISOString()}
            endsAt={booking.endsAt.toISOString()}
            initialStatus={getBookingStatus(booking.startsAt, booking.endsAt, now)}
          />
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${open ? 'text-emerald-700' : 'text-zinc-500'}`}>
            {open ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
            {open ? 'Daftar hadir dibuka' : 'Daftar hadir ditutup'}
          </span>
        </div>
        <p className="mt-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{booking.bookerName}</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">Satker/Instansi: </span>
          {booking.satker}
        </p>
        {/* Plain text only; line breaks kept via CSS */}
        <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-700">{booking.agenda}</p>
        {open && (
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <Link
              href={`/hadir/${booking.room.id}`}
              prefetch={false}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
            >
              <PenLine className="size-4" />
              Isi Daftar Hadir
            </Link>
          </div>
        )}
      </section>

      <div className="mx-auto max-w-3xl">
        <AttendeeList attendees={attendees} />
      </div>
    </div>
  );
}

function NotFoundCard() {
  return (
    <section
      aria-labelledby="missing-heading"
      className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8"
    >
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
        <CalendarX2 className="size-6" />
      </span>
      <h2 id="missing-heading" className="text-lg font-semibold text-primary">
        Rapat tidak ditemukan
      </h2>
      <p className="mt-2 text-sm text-pretty text-zinc-600">Rapat tidak ditemukan atau sudah dibatalkan.</p>
      <div className="mt-5 flex justify-center">
        <BackLink href="/">Pilih ruangan</BackLink>
      </div>
    </section>
  );
}

function AttendanceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat daftar hadir" className="space-y-8">
      <div className="h-4 w-40 rounded bg-zinc-200 motion-safe:animate-pulse" />
      <div className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 motion-safe:animate-pulse sm:p-6">
        <div className="h-3 w-32 rounded bg-zinc-200" />
        <div className="mt-3 h-6 w-64 max-w-full rounded bg-zinc-200" />
        <div className="mt-3 h-3 w-28 rounded bg-zinc-200" />
        <div className="mt-4 h-3 w-full rounded bg-zinc-100" />
      </div>
      <div className="mx-auto max-w-3xl space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-zinc-200 bg-white motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
