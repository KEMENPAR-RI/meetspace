import Link from 'next/link';
import { io } from 'next/cache';
import { CalendarX2 } from 'lucide-react';
import { getUpcomingBookings } from '@/lib/booking/queries';
import { formatDateLabel, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { StatusBadge } from './status-badge';

// Public, read-only: one room, no admin actions (I1).
export async function BookingList({ roomId }: { roomId: string }) {
  // Must precede `new Date()` under Cache Components.
  await io();
  const now = new Date();
  const bookings = await getUpcomingBookings(now, { roomId });

  if (bookings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
        <CalendarX2 className="mx-auto mb-2 block size-6 text-zinc-400" />
        Belum ada booking mendatang di ruangan ini
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {bookings.map((b) => (
        <li
          key={b.id}
          className="rounded-xl border border-zinc-200 bg-white p-4 has-[[data-status=done]]:opacity-60"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold text-primary">
              <time dateTime={b.startsAt.toISOString()}>{formatDateLabel(b.startsAt)}</time>
            </p>
            <p className="flex items-center gap-2 text-sm tabular-nums text-zinc-700">
              <StatusBadge
                startsAt={b.startsAt.toISOString()}
                endsAt={b.endsAt.toISOString()}
                initialStatus={getBookingStatus(b.startsAt, b.endsAt, now)}
              />
              {formatTimeRange(b.startsAt, b.endsAt)}
            </p>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">{b.bookerName}</span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">Satker/Instansi: </span>
            {b.satker}
          </p>
          {/* Plain text only; line breaks kept via CSS */}
          <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-700">{b.agenda}</p>
          <div className="mt-3">
            <Link
              href={`/rapat/${b.id}`}
              aria-label={`Daftar hadir rapat ${b.bookerName} ${formatTimeRange(b.startsAt, b.endsAt)}`}
              className="inline-flex items-center rounded-md border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
            >
              Daftar hadir
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BookingListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Memuat daftar booking" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-xl border border-zinc-200 bg-white p-4 motion-safe:animate-pulse">
          <div className="h-4 w-40 rounded bg-zinc-200" />
          <div className="mt-3 h-3 w-24 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-full rounded bg-zinc-100" />
        </li>
      ))}
    </ul>
  );
}
