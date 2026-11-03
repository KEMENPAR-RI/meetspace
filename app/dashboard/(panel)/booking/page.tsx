import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { io } from 'next/cache';
import { getRoomScope, requireUser } from '@/lib/auth/access';
import { getUpcomingBookings } from '@/lib/booking/queries';
import { getScopeRooms } from '@/lib/room/queries';
import { DashboardBookingList } from '../../_components/dashboard-booking-list';
import { RoomFilter } from '../../_components/room-filter';
import { ListSkeleton, PageHeader } from '../../_components/ui';

export const metadata: Metadata = { title: 'Booking · Dashboard', robots: { index: false, follow: false } };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function DashboardBookingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat booking" />}>
      <BookingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BookingContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const scope = getRoomScope(user);
  const raw = (await searchParams).room;
  const roomId = typeof raw === 'string' && raw ? raw : undefined;

  await io();
  const rooms = await getScopeRooms(user);
  // Out-of-scope or unknown room: same 404 either way (G4).
  if (roomId && !rooms.some((r) => r.id === roomId)) notFound();

  const now = new Date();
  const bookings = await getUpcomingBookings(now, { scope, roomId });
  const activeRooms = rooms.filter((r) => r.isActive).map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <PageHeader
        eyebrow="Booking"
        title="Booking Mendatang"
        description="Edit, pindah ruangan, atau batalkan booking. Daftar hadir dan QR ada di detail rapat."
        actions={<RoomFilter rooms={rooms} selected={roomId} action="/dashboard/booking" />}
      />
      <DashboardBookingList bookings={bookings} rooms={activeRooms} now={now} filtered={Boolean(roomId)} />
    </>
  );
}
