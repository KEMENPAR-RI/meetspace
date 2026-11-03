import { Suspense } from 'react';
import type { Metadata } from 'next';
import { io } from 'next/cache';
import { isSuperadmin, requireUser } from '@/lib/auth/access';
import { LOG_MAX_ROWS } from '@/lib/booking/log';
import { loadDashboardLog } from '@/lib/booking/log-loader';
import { ExportButtons } from '@/app/_components/export-buttons';
import { LogFilterBar } from '@/app/_components/log-filter-bar';
import { LogView } from '@/app/_components/log-view';
import { ResetLogButton } from '@/app/_components/reset-log-button';
import { PageHeader } from '../../_components/ui';

export const metadata: Metadata = { title: 'Log Reservasi · Dashboard', robots: { index: false, follow: false } };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function DashboardLogPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LogSkeleton />}>
      <LogContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LogContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();

  // Must precede the default-year clock read under Cache Components.
  await io();
  const { filters, data, truncated, rooms, exportQuery: query } = await loadDashboardLog(
    user,
    await searchParams,
    new Date(),
  );
  const activeRooms = rooms.filter((r) => r.isActive);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Log"
        title="Log Reservasi"
        actions={
          <>
            <ExportButtons searchParams={query} disabled={truncated} />
            {/* H4: superadmin only; the action re-checks the role */}
            {isSuperadmin(user) && <ResetLogButton />}
          </>
        }
      />

      <LogFilterBar value={filters} satkers={data.satkers} rooms={rooms} />

      {truncated ? (
        <p
          role="status"
          className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500"
        >
          Data terlalu banyak (lebih dari {LOG_MAX_ROWS} reservasi). Persempit filter untuk menampilkan log.
        </p>
      ) : (
        /* key: switching filters/year resets the open day */
        <LogView
          key={query}
          data={data}
          rooms={activeRooms}
          filtered={Boolean(filters.room || filters.satker || filters.dateStart || filters.dateEnd || filters.bookerName)}
        />
      )}
    </div>
  );
}


function LogSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat log reservasi" className="space-y-6">
      <div className="h-8 w-48 rounded bg-zinc-200 motion-safe:animate-pulse" />
      <div className="h-24 rounded-2xl border border-zinc-200 bg-white motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-64 rounded-xl border border-zinc-200 bg-white motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
