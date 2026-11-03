import { notFound } from 'next/navigation';

import { canAccessRoom, getRoomScope } from '@/lib/auth/scope';
import type { CurrentUser } from '@/lib/auth/types';
import { getScopeRooms } from '@/lib/room/queries';
import type { RoomOption } from '@/lib/room/types';

import { buildLogData, parseLogFilters, resolveRange, type LogData, type LogFilters, type LogSearchParams } from './log';
import { getDistinctSatker, getLogBookings } from './queries';

export type DashboardLog = {
  filters: LogFilters;
  data: LogData;
  truncated: boolean;
  rooms: RoomOption[];
  // Querystring for /api/log/export (without `format`).
  exportQuery: string;
};

// Dashboard log page: scoped to the user; a `room` outside the scope 404s, same as the export (G4).
// Call after requireUser() and io().
export async function loadDashboardLog(user: CurrentUser, params: LogSearchParams, now: Date): Promise<DashboardLog> {
  const filters = parseLogFilters(params, now);
  if (filters.room && !canAccessRoom(user, filters.room)) notFound();
  const scope = getRoomScope(user);
  const range = resolveRange(filters);

  const [{ rows, truncated }, satkers, rooms] = await Promise.all([
    getLogBookings(range, { satker: filters.satker, bookerName: filters.bookerName, roomId: filters.room, scope }),
    getDistinctSatker(range, { roomId: filters.room, scope }),
    getScopeRooms(user),
  ]);

  return {
    filters,
    data: buildLogData(truncated ? [] : rows, filters, satkers),
    truncated,
    rooms,
    exportQuery: toLogQuery(filters),
  };
}

export function toLogQuery(f: LogFilters): string {
  const qs = new URLSearchParams({ year: String(f.year) });
  if (f.room) qs.set('room', f.room);
  if (f.satker) qs.set('satker', f.satker);
  if (f.dateStart) qs.set('dateStart', f.dateStart);
  if (f.dateEnd) qs.set('dateEnd', f.dateEnd);
  if (f.bookerName) qs.set('bookerName', f.bookerName);
  return qs.toString();
}
