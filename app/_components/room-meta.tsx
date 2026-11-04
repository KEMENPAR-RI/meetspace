import { Building2, Layers, Users, type LucideIcon } from 'lucide-react';

type RoomMetaInput = {
  building?: string | null;
  floor?: string | null;
  capacity?: number | null;
};

export function RoomMeta({ room, className = '' }: { room: RoomMetaInput; className?: string }) {
  const parts: { text: string; Icon: LucideIcon }[] = [];
  if (room.building) parts.push({ text: room.building, Icon: Building2 });
  if (room.floor) parts.push({ text: `Lantai ${room.floor}`, Icon: Layers });
  if (room.capacity) parts.push({ text: `${room.capacity} orang`, Icon: Users });
  if (parts.length === 0) return null;
  return (
    <p className={`flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600 ${className}`}>
      {parts.map(({ text, Icon }) => (
        <span key={text} className="inline-flex items-center gap-1.5">
          <Icon className="size-4 shrink-0 text-zinc-400" />
          {text}
        </span>
      ))}
    </p>
  );
}
