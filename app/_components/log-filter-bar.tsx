'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListFilter, LoaderCircle, RotateCcw } from 'lucide-react';
import type { LogFilters } from '@/lib/booking/log';
import { BOOKING_LIMITS } from '@/lib/booking/types';

// rooms: every room in the user's scope (inactive included, for history).
type Props = { value: LogFilters; satkers: string[]; rooms: { id: string; name: string }[] };

const BASE_PATH = '/dashboard/log';

// Mirrors LOG_YEAR_MIN/MAX; not imported to keep zod out of the client bundle.
const YEAR_MIN = 2000;
const YEAR_MAX = 2100;

const inputClass =
  'block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

const labelClass = 'block text-xs font-medium text-zinc-700';

// URL is the source of truth; key remounts the form after navigation/reset.
export function LogFilterBar(props: Props) {
  return <FilterForm key={JSON.stringify(props.value)} {...props} />;
}

function FilterForm({ value, satkers, rooms }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [year, setYear] = useState(String(value.year));
  const validYear = /^\d{4}$/.test(year) ? year : String(value.year);
  // Keep a stored satker selectable even if it is no longer in the list.
  const options = value.satker && !satkers.includes(value.satker) ? [value.satker, ...satkers] : satkers;
  const hasExtra = Boolean(value.room || value.satker || value.dateStart || value.dateEnd || value.bookerName);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget)) {
      const s = typeof v === 'string' ? v.trim() : '';
      if (s) qs.set(k, s);
    }
    // Date range outside the chosen year is meaningless; drop it.
    for (const k of ['dateStart', 'dateEnd']) {
      if (!qs.get(k)?.startsWith(`${qs.get('year')}-`)) qs.delete(k);
    }
    startTransition(() => router.push(`${BASE_PATH}?${qs.toString()}`));
  };

  return (
    <form
      action={BASE_PATH}
      method="get"
      onSubmit={onSubmit}
      aria-label="Filter log reservasi"
      aria-busy={pending || undefined}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[6rem_repeat(4,minmax(0,1fr))_minmax(0,1.3fr)]">
        <div className="space-y-1">
          <label htmlFor="log-year" className={labelClass}>
            Tahun
          </label>
          <input
            id="log-year"
            name="year"
            type="number"
            inputMode="numeric"
            required
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="log-room" className={labelClass}>
            Ruangan
          </label>
          <select id="log-room" name="room" defaultValue={value.room ?? ''} className={inputClass}>
            <option value="">Semua ruangan</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="log-satker" className={labelClass}>
            Satker/Instansi
          </label>
          <select id="log-satker" name="satker" defaultValue={value.satker ?? ''} className={inputClass}>
            <option value="">Semua satker/instansi</option>
            {options.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="log-date-start" className={labelClass}>
            Dari tanggal
          </label>
          <input
            id="log-date-start"
            name="dateStart"
            type="date"
            min={`${validYear}-01-01`}
            max={`${validYear}-12-31`}
            defaultValue={value.dateStart ?? ''}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="log-date-end" className={labelClass}>
            Sampai tanggal
          </label>
          <input
            id="log-date-end"
            name="dateEnd"
            type="date"
            min={`${validYear}-01-01`}
            max={`${validYear}-12-31`}
            defaultValue={value.dateEnd ?? ''}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="log-booker" className={labelClass}>
            Nama pemesan
          </label>
          <input
            id="log-booker"
            name="bookerName"
            type="search"
            maxLength={BOOKING_LIMITS.bookerName}
            placeholder="Cari nama…"
            defaultValue={value.bookerName ?? ''}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {hasExtra && (
          <span className="text-xs text-zinc-500 sm:mr-auto">Filter aktif diterapkan ke kalender dan ekspor.</span>
        )}
        <Link
          href={BASE_PATH}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
        >
          <RotateCcw className="size-4" />
          Reset
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
        >
          {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <ListFilter className="size-4" />}
          {pending ? 'Memuat…' : 'Terapkan'}
        </button>
      </div>
    </form>
  );
}
