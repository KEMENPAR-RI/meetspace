import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { io } from 'next/cache';
import { Clock, DoorOpen, UserRound } from 'lucide-react';
import { requireBookingAccess } from '@/lib/auth/access';
import { getBookingDetail } from '@/lib/booking/queries';
import { formatDateLabel, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { BackLink } from '@/app/_components/back-link';
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
  const booking = await getBookingDetail(id);
  if (!booking) notFound();

  const now = new Date();

  return (
    <div className="space-y-8">
      <BackLink href={`/dashboard/booking?room=${booking.room.id}`}>Booking {booking.room.name}</BackLink>

      <section aria-labelledby="meeting-heading" className={`${cardClass} border-l-4 border-l-secondary`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          <DoorOpen className="size-4 shrink-0" />
          Rapat · <span className="normal-case">{booking.room.name}</span>
        </p>
        <h1 id="meeting-heading" className="mt-1 text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          <time dateTime={booking.startsAt.toISOString()}>{formatDateLabel(booking.startsAt)}</time>
        </h1>
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
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-600">
          <UserRound className="size-4 shrink-0 text-zinc-400" />
          <span className="font-medium text-zinc-800">{booking.bookerName}</span>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">Satker/Instansi: </span>
          {booking.satker}
        </p>
        <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-700">{booking.agenda}</p>
      </section>
    </div>
  );
}
