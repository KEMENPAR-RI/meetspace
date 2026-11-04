import { Suspense } from 'react';
import { io } from 'next/cache';
import { Building2 } from 'lucide-react';
import { getActiveRooms } from '@/lib/booking/queries';
import { RoomGrid, RoomGridSkeleton } from './_components/room-grid';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

export default function Home() {
  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 font-sans sm:px-6 lg:py-14">
        <SiteHeader />
        <section aria-labelledby="rooms-heading">
          <h2 id="rooms-heading" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
            <Building2 className="size-6" />
            Pilih Ruangan
          </h2>
          <p className="mt-1 mb-6 text-sm text-zinc-600">
            Pilih ruangan untuk melihat jadwal dan membuat booking.
          </p>
          <Suspense fallback={<RoomGridSkeleton />}>
            <Rooms />
          </Suspense>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

async function Rooms() {
  // Must precede DB queries (mariadb pool reads the clock) under Cache Components.
  await io();
  const rooms = await getActiveRooms();
  return <RoomGrid rooms={rooms} />;
}
