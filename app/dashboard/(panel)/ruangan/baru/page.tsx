import { Suspense } from 'react';
import type { Metadata } from 'next';
import { io } from 'next/cache';
import { createRoom } from '@/app/actions/room';
import { requireSuperadmin } from '@/lib/auth/access';
import { getAssignableAdmins } from '@/lib/room/queries';
import { BackLink } from '@/app/_components/back-link';
import { RoomForm } from '../../../_components/room-form';
import { ListSkeleton, PageHeader, cardClass } from '../../../_components/ui';

export const metadata: Metadata = { title: 'Tambah Ruangan · Dashboard', robots: { index: false, follow: false } };

export default function NewRoomPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat formulir" rows={1} />}>
      <NewRoomContent />
    </Suspense>
  );
}

async function NewRoomContent() {
  await requireSuperadmin();
  await io();
  const admins = await getAssignableAdmins();

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/dashboard/ruangan">Ruangan</BackLink>
      <PageHeader title="Tambah Ruangan" />
      <section className={cardClass}>
        <RoomForm action={createRoom} admins={admins} submitLabel="Simpan Ruangan" />
      </section>
    </div>
  );
}
