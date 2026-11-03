import Link from 'next/link';
import { CancelButton } from '@/app/_components/cancel-button';
import { EditBookingButton } from '@/app/_components/edit-booking-button';
import type { RoomOption } from '@/lib/room/types';
import { StatusBadge } from '@/app/_components/status-badge';
import { formatDateLabel, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { EmptyState, smallButton } from './ui';

export type DashboardBooking = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  bookerName: string;
  satker: string;
  agenda: string;
  room: { id: string; name: string };
};

// rooms: active rooms in scope, the targets for "move room" (H3).
export function DashboardBookingList({
  bookings,
  rooms,
  now,
  filtered,
}: {
  bookings: DashboardBooking[];
  rooms: Pick<RoomOption, 'id' | 'name'>[];
  now: Date;
  filtered: boolean;
}) {
  if (bookings.length === 0) {
    return <EmptyState>{filtered ? 'Tidak ada booking mendatang di ruangan ini.' : 'Belum ada booking mendatang.'}</EmptyState>;
  }

  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        const status = getBookingStatus(b.startsAt, b.endsAt, now);
        const when = `${formatDateLabel(b.startsAt)} ${formatTimeRange(b.startsAt, b.endsAt)}`;
        return (
          <li
            key={b.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 has-[[data-status=done]]:opacity-60 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{b.room.name}</p>
                <p className="mt-0.5 text-sm font-semibold text-primary">
                  <time dateTime={b.startsAt.toISOString()}>{formatDateLabel(b.startsAt)}</time>
                  <span className="ml-2 font-medium tabular-nums text-zinc-700">
                    {formatTimeRange(b.startsAt, b.endsAt)}
                  </span>
                </p>
              </div>
              <StatusBadge
                startsAt={b.startsAt.toISOString()}
                endsAt={b.endsAt.toISOString()}
                initialStatus={status}
              />
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">{b.bookerName}</span>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">Satker/Instansi: </span>
              {b.satker}
            </p>
            <p className="mt-1.5 whitespace-pre-line break-words text-sm text-zinc-700">{b.agenda}</p>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <Link href={`/dashboard/rapat/${b.id}`} className={smallButton} aria-label={`Daftar hadir ${when}`}>
                Daftar hadir
              </Link>
              {/* UX only; actions re-check access */}
              {status !== 'done' && (
                <>
                  <EditBookingButton
                    booking={{
                      id: b.id,
                      startsAt: b.startsAt.toISOString(),
                      endsAt: b.endsAt.toISOString(),
                      bookerName: b.bookerName,
                      satker: b.satker,
                      agenda: b.agenda,
                      roomId: b.room.id,
                      roomName: b.room.name,
                    }}
                    rooms={rooms}
                  />
                  <div className="ml-auto">
                    <CancelButton id={b.id} />
                  </div>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
