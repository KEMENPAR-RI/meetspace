import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { io } from 'next/cache';
import { signAttendance } from '@/app/actions/attendance';
import { requireBookingAccess } from '@/lib/auth/access';
import {
  ATTENDANCE_CLOSE_AFTER_MS,
  ATTENDANCE_OPEN_BEFORE_MS,
  isAttendanceOpen,
} from '@/lib/booking/attendance-window';
import { getBookingAttendance } from '@/lib/booking/queries';
import type { Attendee } from '@/lib/booking/types';
import { formatDateLabel, formatTime, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { AttendanceForm } from '@/app/_components/attendance-form';
import { AttendeeList } from '@/app/_components/attendee-list';
import { BackLink } from '@/app/_components/back-link';
import { ExportButtons } from '@/app/_components/export-buttons';
import { StatusBadge } from '@/app/_components/status-badge';
import { ListSkeleton, cardClass } from '../../../_components/ui';

export const metadata: Metadata = { title: 'Detail Rapat · Dashboard', robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default function DashboardMeetingPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat detail rapat" />}>
      <MeetingContent params={params} />
    </Suspense>
  );
}

async function MeetingContent({ params }: { params: Params }) {
  const { id } = await params;
  // Missing and out-of-scope look the same (G4).
  await requireBookingAccess(id);

  // Must precede DB queries and `new Date()` under Cache Components.
  await io();
  const data = await getBookingAttendance(id);
  if (!data) notFound();

  const { booking } = data;
  const now = new Date();
  const open = isAttendanceOpen(booking.startsAt, booking.endsAt, now);
  const attendees = data.attendees.map((a) => ({
    id: a.id,
    name: a.name,
    satker: a.satker,
    role: a.role,
    gender: a.gender,
    phone: a.phone,
    signedAtISO: a.signedAt.toISOString(),
    signedAtLabel: `${formatDateLabel(a.signedAt)}, ${formatTime(a.signedAt)} WIB`,
  })) satisfies Attendee[];

  return (
    <div className="space-y-8">
      <BackLink href={`/dashboard/booking?room=${booking.room.id}`}>Booking {booking.room.name}</BackLink>

      <section aria-labelledby="meeting-heading" className={`${cardClass} border-l-4 border-l-secondary`}>
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Rapat · <span className="normal-case">{booking.room.name}</span>
        </p>
        <h1 id="meeting-heading" className="mt-1 text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          <time dateTime={booking.startsAt.toISOString()}>{formatDateLabel(booking.startsAt)}</time>
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="font-medium tabular-nums text-zinc-700">
            {formatTimeRange(booking.startsAt, booking.endsAt)}
          </span>
          <StatusBadge
            startsAt={booking.startsAt.toISOString()}
            endsAt={booking.endsAt.toISOString()}
            initialStatus={getBookingStatus(booking.startsAt, booking.endsAt, now)}
          />
          <span className={`text-xs font-medium ${open ? 'text-emerald-700' : 'text-zinc-500'}`}>
            {open ? 'Daftar hadir dibuka' : 'Daftar hadir ditutup'}
          </span>
        </div>
        <p className="mt-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{booking.bookerName}</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">Satker/Instansi: </span>
          {booking.satker}
        </p>
        <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-700">{booking.agenda}</p>

        <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-zinc-100 pt-4">
          <div className="sm:ml-auto">
            <ExportButtons
              endpoint={`/api/rapat/${booking.id}/export`}
              searchParams=""
              label="Ekspor daftar hadir rapat ini"
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="sign-heading" className={`${cardClass} lg:sticky lg:top-8`}>
          <h2 id="sign-heading" className="mb-5 text-lg font-semibold text-primary">
            Isi Daftar Hadir
          </h2>
          {open ? (
            <AttendanceForm action={signAttendance.bind(null, booking.id)} variant="internal" />
          ) : (
            <ClosedNotice startsAt={booking.startsAt} endsAt={booking.endsAt} now={now} />
          )}
        </section>

        <AttendeeList attendees={attendees} showPhone canDelete />
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
      <p className="mt-1 text-sm tabular-nums text-zinc-600">Dibuka {formatTimeRange(opensAt, closesAt)}</p>
    </div>
  );
}
