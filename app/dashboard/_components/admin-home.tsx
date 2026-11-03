import Link from 'next/link';
import { RoomMeta } from '@/app/_components/room-meta';
import { StatusBadge } from '@/app/_components/status-badge';
import type { AdminHome as AdminHomeData } from '@/lib/booking/admin-home';
import { formatDateLabel, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import type { UpcomingBooking } from '@/lib/booking/types';
import { RoomQrButtons } from './room-qr-buttons';
import { EmptyState, cardClass, primaryButton, smallButton } from './ui';

// ADMIN role: one assigned room. Focal point = the meeting running now.
export function AdminHome({ data, now }: { data: AdminHomeData; now: Date }) {
  const { room, current, today, upcoming } = data;

  return (
    <div className="space-y-8">
      <section aria-labelledby="room-heading" className={`${cardClass} border-t-4 border-t-secondary`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Ruangan Anda</p>
            <h2 id="room-heading" className="mt-0.5 text-xl font-semibold break-words text-primary">
              {room.name}
            </h2>
            <RoomMeta room={room} className="mt-1" />
            {room.facilities && (
              <p className="mt-2 text-sm whitespace-pre-line break-words text-zinc-700">
                <span className="font-medium text-zinc-800">Fasilitas: </span>
                {room.facilities}
              </p>
            )}
            {!room.isActive && (
              <p className="mt-2 text-sm font-medium text-amber-800">Ruangan sedang nonaktif (tidak bisa dibooking).</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <RoomQrButtons room={room} size="md" />
          </div>
        </div>
      </section>

      <section aria-labelledby="current-heading">
        <h2 id="current-heading" className="mb-3 text-lg font-semibold text-primary">
          Rapat berlangsung
        </h2>
        {current ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold tabular-nums text-primary">
                {formatTimeRange(current.startsAt, current.endsAt)}
              </p>
              <StatusBadge
                startsAt={current.startsAt.toISOString()}
                endsAt={current.endsAt.toISOString()}
                initialStatus={getBookingStatus(current.startsAt, current.endsAt, now)}
              />
            </div>
            <p className="mt-2 text-base font-medium whitespace-pre-line break-words text-zinc-900">{current.agenda}</p>
            <p className="mt-1 text-sm text-zinc-600">
              {current.bookerName}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">Satker/Instansi: </span>
              {current.satker}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
              <p className="text-sm text-zinc-700">
                <span className="text-2xl font-semibold tabular-nums text-primary">{current.attendeeCount}</span> peserta
                hadir
              </p>
              <Link href={`/dashboard/rapat/${current.id}`} className={primaryButton}>
                Lihat daftar hadir
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState>Tidak ada rapat yang sedang berlangsung.</EmptyState>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <BookingSection id="today" title="Hari ini" bookings={today} now={now} empty="Tidak ada booking hari ini." />
        <BookingSection
          id="upcoming"
          title="Mendatang"
          bookings={upcoming}
          now={now}
          showDate
          empty="Belum ada booking mendatang."
        />
      </div>
    </div>
  );
}

function BookingSection({
  id,
  title,
  bookings,
  now,
  showDate,
  empty,
}: {
  id: string;
  title: string;
  bookings: UpcomingBooking[];
  now: Date;
  showDate?: boolean;
  empty: string;
}) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="mb-3 text-lg font-semibold text-primary">
        {title}
      </h2>
      {bookings.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 has-[[data-status=done]]:opacity-60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-primary">
                  {showDate && (
                    <>
                      <time dateTime={b.startsAt.toISOString()}>{formatDateLabel(b.startsAt)}</time>{' '}
                    </>
                  )}
                  <span className="tabular-nums">{formatTimeRange(b.startsAt, b.endsAt)}</span>
                </p>
                <StatusBadge
                  startsAt={b.startsAt.toISOString()}
                  endsAt={b.endsAt.toISOString()}
                  initialStatus={getBookingStatus(b.startsAt, b.endsAt, now)}
                />
              </div>
              <p className="mt-1 line-clamp-2 text-sm break-words text-zinc-700">{b.agenda}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs text-zinc-500">
                  {b.bookerName} · {b.satker}
                </p>
                <Link href={`/dashboard/rapat/${b.id}`} className={smallButton}>
                  Detail
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
