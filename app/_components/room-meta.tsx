type RoomMetaInput = {
  building?: string | null;
  floor?: string | null;
  capacity?: number | null;
};

// "Gedung A · Lantai 3 · 40 orang"; empty parts are skipped.
export function roomMetaParts(room: RoomMetaInput): string[] {
  const parts: string[] = [];
  if (room.building) parts.push(room.building);
  if (room.floor) parts.push(`Lantai ${room.floor}`);
  if (room.capacity) parts.push(`${room.capacity} orang`);
  return parts;
}

export function RoomMeta({ room, className = '' }: { room: RoomMetaInput; className?: string }) {
  const parts = roomMetaParts(room);
  if (parts.length === 0) return null;
  return (
    <p className={`flex flex-wrap gap-x-2 gap-y-1 text-sm text-zinc-600 ${className}`}>
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          {p}
        </span>
      ))}
    </p>
  );
}
