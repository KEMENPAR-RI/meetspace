// Shared room contract (client-safe). Field names double as form input `name` attributes.

export type RoomField = 'name' | 'building' | 'floor' | 'capacity' | 'facilities' | 'isActive' | 'adminIds';

// Shared by server validation and input `maxLength`/`min`/`max`.
export const ROOM_LIMITS = {
  nameMin: 2,
  name: 100,
  building: 100,
  floor: 20,
  facilities: 500,
  capacityMin: 1,
  capacityMax: 1000,
} as const;

// Fixed id of the room created by the multi-room migration.
export const DEFAULT_ROOM_ID = '00000000-0000-4000-8000-000000000001';

// Public listing (/): active rooms only.
export type PublicRoom = {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  capacity: number | null;
};

// Public room page (/ruang/[id]).
export type RoomDetail = PublicRoom & { facilities: string | null; isActive: boolean };

// Room select options (filters, move-booking select).
export type RoomOption = { id: string; name: string; isActive: boolean };

// Dashboard room card; `admins` = active admin PJ (empty -> badge "Belum ada penanggung jawab", F4).
export type DashboardRoom = RoomDetail & {
  admins: { id: string; name: string; username: string }[];
  bookingCount: number;
};

// Superadmin edit form initial values.
export type RoomForEdit = RoomDetail & { adminIds: string[]; bookingCount: number };

// `room` = current assignment (1 admin = 1 room); null = free.
export type AssignableAdmin = { id: string; name: string; username: string; room: { id: string; name: string } | null };
