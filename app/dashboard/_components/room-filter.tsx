import { inputClass, secondaryButton } from './ui';

// Plain GET form: works without JS, URL stays the source of truth.
export function RoomFilter({
  rooms,
  selected,
  action,
}: {
  rooms: { id: string; name: string }[];
  selected?: string;
  action: string;
}) {
  return (
    <form action={action} method="get" role="search" aria-label="Filter ruangan" className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1 space-y-1 sm:flex-none">
        <label htmlFor="room-filter" className="block text-xs font-medium text-zinc-700">
          Ruangan
        </label>
        <select id="room-filter" name="room" defaultValue={selected ?? ''} className={inputClass}>
          <option value="">Semua ruangan</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={secondaryButton}>
        Tampilkan
      </button>
    </form>
  );
}
