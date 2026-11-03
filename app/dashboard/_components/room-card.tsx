import Link from 'next/link';
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
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            Belum ada penanggung jawab
          </Badge>
        </p>
      )}
      {superadmin && !noPic && (
        <p className="mt-3 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">PJ:</span> {room.admins.map((a) => a.name).join(', ')}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <RoomQrButtons room={room} />
        <Link href={`/dashboard/booking?room=${room.id}`} className={smallButton}>
          Booking
        </Link>
        {superadmin && (
          <Link href={`/dashboard/ruangan/${room.id}`} className={smallButton} aria-label={`Edit ruangan ${room.name}`}>
            Edit
          </Link>
        )}
      </div>
    </li>
  );
}
