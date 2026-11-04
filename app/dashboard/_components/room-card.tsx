import Link from 'next/link';
import { CalendarDays, Pencil, TriangleAlert, UserRound } from 'lucide-react';
import { RoomMeta } from '@/app/_components/room-meta';
import type { DashboardRoom } from '@/lib/room/types';
import { RoomQrButtons } from './room-qr-buttons';
import { Badge, smallButton } from './ui';

export function RoomCard({ room, superadmin }: { room: DashboardRoom; superadmin: boolean }) {
  const noPic = room.admins.length === 0;

  return (
    <li className="flex flex-col rounded-2xl border border-zinc-200 border-t-4 border-t-secondary bg-white p-5 shadow-sm data-[inactive=true]:border-t-zinc-300" data-inactive={!room.isActive}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-base leading-snug font-semibold break-words text-primary">{room.name}</h3>
        {!room.isActive && <Badge tone="muted">Nonaktif</Badge>}
      </div>
      <RoomMeta room={room} className="mt-1" />
      {/* F4: superadmin-only warning */}
      {superadmin && noPic && (
        <p className="mt-3">
          <Badge tone="warning">
            <TriangleAlert className="size-3.5" />
            Belum ada penanggung jawab
          </Badge>
        </p>
      )}
      {superadmin && !noPic && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500">
          <UserRound className="size-3.5 shrink-0" />
          <span className="min-w-0"><span className="font-medium text-zinc-700">PJ:</span> {room.admins.map((a) => a.name).join(', ')}</span>
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <RoomQrButtons room={room} />
        <Link href={`/dashboard/booking?room=${room.id}`} className={smallButton}>
          <CalendarDays className="size-3.5" />
          Booking
        </Link>
        {superadmin && (
          <Link href={`/dashboard/ruangan/${room.id}`} className={smallButton} aria-label={`Edit ruangan ${room.name}`}>
            <Pencil className="size-3.5" />
            Edit
          </Link>
        )}
      </div>
    </li>
  );
}
