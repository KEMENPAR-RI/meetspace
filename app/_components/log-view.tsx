'use client';

import { useRef, useState } from 'react';
import type { LogData } from '@/lib/booking/log';
import { DayDetailDialog } from './day-detail-dialog';
import type { RoomOption } from '@/lib/room/types';
import { YearCalendar } from './year-calendar';

type Props = { data: LogData; filtered: boolean; rooms: Pick<RoomOption, 'id' | 'name'>[] };

export function LogView({ data, filtered, rooms }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Day emptied by a delete/edit: keep the dialog mounted so it closes itself.
  const openDay = openKey
    ? (data.days.find((d) => d.dateKey === openKey) ?? { dateKey: openKey, count: 0, entries: [] })
    : null;

  // Runs after the native focus restore; an emptied day's button is now a <span>, so focus a stable target.
  const closeDay = () => {
    if (openDay?.entries.length === 0) headingRef.current?.focus();
    setOpenKey(null);
  };

  return (
    <section aria-labelledby="calendar-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          ref={headingRef}
          id="calendar-heading"
          tabIndex={-1}
          className="text-lg font-semibold text-primary focus:outline-none"
        >
          Kalender {data.year}
        </h3>
        {data.total > 0 && (
          <p className="text-sm text-zinc-600 tabular-nums">
            <span className="font-semibold text-primary">{data.total}</span> reservasi pada{' '}
            <span className="font-semibold text-primary">{data.days.length}</span> hari
          </p>
        )}
      </div>

      {data.days.length === 0 && (
        <p
          role="status"
          className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500"
        >
          {filtered
            ? 'Tidak ada reservasi yang cocok dengan filter ini.'
            : `Tidak ada reservasi pada tahun ${data.year}.`}
        </p>
      )}

      <YearCalendar year={data.year} days={data.days} onPickDay={setOpenKey} />

      {/* Mounted on demand, like EditBookingDialog. */}
      {openDay && <DayDetailDialog day={openDay} rooms={rooms} onClose={closeDay} />}
    </section>
  );
}
