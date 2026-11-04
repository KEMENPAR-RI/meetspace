import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, CalendarCheck, CalendarX2, DoorClosed, LayoutDashboard } from 'lucide-react';
import { io } from 'next/cache';
import { getRoomScope, isSuperadmin, requireUser } from '@/lib/auth/access';
import { loadAdminHome } from '@/lib/booking/admin-home';
import { getTodayBookings } from '@/lib/booking/queries';
import { formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { getDashboardRooms } from '@/lib/room/queries';
import { StatusBadge } from '@/app/_components/status-badge';
import { AdminHome } from '../_components/admin-home';
import { RoomCard } from '../_components/room-card';
import { EmptyState, ListSkeleton, PageHeader, cardClass } from '../_components/ui';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default function DashboardHome() {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat ringkasan" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await requireUser();
  const superadmin = isSuperadmin(user);
  const scope = getRoomScope(user);

  // Must precede DB queries and `new Date()` under Cache Components.
  await io();
  const now = new Date();

  if (!superadmin) {
    const home = await loadAdminHome(user, now);
    return (
      <>
        <PageHeader eyebrow="Ringkasan" title={`Halo, ${user.name}`} icon={<LayoutDashboard />} />
        {home ? (
          <AdminHome data={home} now={now} />
        ) : (
          <EmptyState icon={<DoorClosed />}>Anda belum ditugaskan ke ruangan. Hubungi superadmin.</EmptyState>
        )}
      </>
    );
  }

  const [rooms, todays] = await Promise.all([getDashboardRooms(user), getTodayBookings(now, { scope })]);

  return (
    <>
      <PageHeader
        eyebrow="Ringkasan"
        title={`Halo, ${user.name}`}
        description="Anda mengelola semua ruangan."
        icon={<LayoutDashboard />}
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <section aria-labelledby="rooms-heading">
          <h2 id="rooms-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold text-primary">
            <Building2 className="size-5" />
            Ruangan
          </h2>
          {rooms.length === 0 ? (
            <EmptyState icon={<DoorClosed />}>
              {superadmin ? (
                <>
                  Belum ada ruangan.{' '}
                  <Link href="/dashboard/ruangan/baru" className="font-medium text-primary underline">
                    Tambah ruangan
                  </Link>
                </>
              ) : (
                'Belum ada ruangan yang ditugaskan kepada Anda. Hubungi superadmin.'
              )}
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} superadmin={superadmin} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="today-heading" className={cardClass}>
          <h2 id="today-heading" className="flex items-center gap-2 text-lg font-semibold text-primary">
            <CalendarCheck className="size-5" />
            Rapat hari ini
          </h2>
          {todays.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
              <CalendarX2 className="size-4 shrink-0 text-zinc-400" />
              Tidak ada rapat hari ini.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {todays.map((b) => (
                <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/dashboard/rapat/${b.id}`}
                    className="group block rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {formatTimeRange(b.startsAt, b.endsAt)}
                      </span>
                      <StatusBadge
                        startsAt={b.startsAt.toISOString()}
                        endsAt={b.endsAt.toISOString()}
                        initialStatus={getBookingStatus(b.startsAt, b.endsAt, now)}
                      />
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-zinc-500">{b.room.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm break-words text-zinc-700 group-hover:underline">
                      {b.agenda}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/booking"
            className="mt-4 inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Semua booking mendatang
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
