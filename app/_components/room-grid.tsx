import Link from 'next/link';
import { ChevronRight, DoorClosed } from 'lucide-react';
import type { PublicRoom } from '@/lib/room/types';
import { RoomMeta } from './room-meta';


export function RoomGrid({ rooms }: { rooms: PublicRoom[] }) {
  if (rooms.length === 0) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500"
      >
        <DoorClosed className="mx-auto mb-2 block size-6 text-zinc-400" />
        Belum ada ruangan yang dapat dibooking.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <li key={room.id}>
          {/* Whole card is the link */}
          <Link
            href={`/ruang/${room.id}`}
            className="group flex h-full flex-col rounded-2xl border border-zinc-200 border-t-4 border-t-secondary bg-white p-5 shadow-sm hover:border-primary/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition"
          >
            <h3 className="text-lg leading-snug font-semibold break-words text-primary">{room.name}</h3>
            <RoomMeta room={room} className="mt-1.5" />
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-medium text-primary group-hover:underline">
              Lihat jadwal &amp; booking
              <ChevronRight className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RoomGridSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Memuat daftar ruangan" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-36 rounded-2xl border border-zinc-200 border-t-4 border-t-secondary/50 bg-white p-5 motion-safe:animate-pulse"
        >
          <div className="h-5 w-40 rounded bg-zinc-200" />
          <div className="mt-3 h-3 w-28 rounded bg-zinc-100" />
        </li>
      ))}
    </ul>
  );
}
