import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { io } from 'next/cache';
import { Building2, ToggleRight, TriangleAlert } from 'lucide-react';
import { updateRoom } from '@/app/actions/room';
import { requireSuperadmin } from '@/lib/auth/access';
import { isBookingId } from '@/lib/booking/validation';
import { getAssignableAdmins, getRoomForEdit } from '@/lib/room/queries';
import { BackLink } from '@/app/_components/back-link';
import { RoomQrButtons } from '../../../_components/room-qr-buttons';
import { RoomActions } from '../../../_components/room-actions';
import { RoomForm } from '../../../_components/room-form';
import { Badge, ListSkeleton, PageHeader, cardClass } from '../../../_components/ui';

export const metadata: Metadata = { title: 'Edit Ruangan · Dashboard', robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default function EditRoomPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat ruangan" rows={2} />}>
      <EditRoomContent params={params} />
    </Suspense>
  );
}

async function EditRoomContent({ params }: { params: Params }) {
  const user = await requireSuperadmin();
  const { id } = await params;
  // Room ids are UUIDs like booking ids.
  if (!isBookingId(id)) notFound();

  await io();
  const [room, admins] = await Promise.all([getRoomForEdit(user, id), getAssignableAdmins()]);
  if (!room) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/dashboard/ruangan">Ruangan</BackLink>
      <PageHeader
        eyebrow="Edit ruangan"
        title={room.name}
        icon={<Building2 />}
        actions={
          <>
            {!room.isActive && <Badge tone="muted">Nonaktif</Badge>}
            {room.adminIds.length === 0 && (
              <Badge tone="warning">
                <TriangleAlert className="size-3.5" />
                Belum ada penanggung jawab
              </Badge>
            )}
            <RoomQrButtons room={room} size="md" />
          </>
        }
      />

      <section aria-label="Data ruangan" className={cardClass}>
        <RoomForm
          action={updateRoom.bind(null, room.id)}
          admins={admins}
          roomId={room.id}
          submitLabel="Simpan Perubahan"
          initial={{
            name: room.name,
            building: room.building,
            floor: room.floor,
            capacity: room.capacity,
            facilities: room.facilities,
            isActive: room.isActive,
            adminIds: room.adminIds,
          }}
        />
      </section>

      <section aria-labelledby="room-status-heading" className={cardClass}>
        <h2 id="room-status-heading" className="mb-3 flex items-center gap-2 text-base font-semibold text-primary">
          <ToggleRight className="size-5" />
          Status &amp; hapus
        </h2>
        <RoomActions
          roomId={room.id}
          roomName={room.name}
          isActive={room.isActive}
          hasBookings={room.bookingCount > 0}
        />
      </section>
    </div>
  );
}
