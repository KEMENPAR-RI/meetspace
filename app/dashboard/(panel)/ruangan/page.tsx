import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, DoorClosed, Plus } from 'lucide-react';
import { io } from 'next/cache';
import { requireSuperadmin } from '@/lib/auth/access';
import { getDashboardRooms } from '@/lib/room/queries';
import { RoomCard } from '../../_components/room-card';
import { EmptyState, ListSkeleton, PageHeader, primaryButton } from '../../_components/ui';

export const metadata: Metadata = { title: 'Ruangan · Dashboard', robots: { index: false, follow: false } };

export default function RoomsPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat ruangan" />}>
      <RoomsContent />
    </Suspense>
  );
}

async function RoomsContent() {
  const user = await requireSuperadmin();
  await io();
  const rooms = await getDashboardRooms(user);

  return (
    <>
      <PageHeader
        eyebrow="Kelola"
        title="Ruangan"
        description="Data ruangan, penanggung jawab, status, dan QR halaman booking."
        icon={<Building2 />}
        actions={
          <Link href="/dashboard/ruangan/baru" className={primaryButton}>
            <Plus className="size-4" />
            Tambah ruangan
          </Link>
        }
      />
      {rooms.length === 0 ? (
        <EmptyState icon={<DoorClosed />}>Belum ada ruangan.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} superadmin />
          ))}
        </ul>
      )}
    </>
  );
}
