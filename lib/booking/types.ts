// Shared contract between form, action, validation, and list.

// Also used as the form input `name` attributes.
export const BOOKING_FIELDS = [
  'date',
  'startTime',
  'endTime',
  'bookerName',
  'satker',
  'agenda',
  // Dashboard edit only (move to another room, H3); ignored on create.
  'roomId',
] as const;

export type BookingField = (typeof BOOKING_FIELDS)[number];

// Exact, case-sensitive phrase required by resetAllBookings; here so the client can import it (no zod).
export const RESET_CONFIRMATION = 'RESET';

// Shared by server validation and input `maxLength`.
export const BOOKING_LIMITS = {
  bookerName: 100,
  satker: 100,
  agenda: 1000,
} as const;

export type BookingFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<BookingField, string>>;
  // Submitted values for refilling inputs after an error.
  values?: Partial<Record<BookingField, string>>;
};

export const initialBookingFormState: BookingFormState = { status: 'idle' };

// Eager-loaded with every booking row (no N+1).
export type BookingRoom = { id: string; name: string };

export type UpcomingBooking = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  bookerName: string;
  satker: string;
  agenda: string;
  roomId: string;
  room: BookingRoom;
};

export type CancelBookingResult = { ok: true } | { ok: false; message: string };

// Serializable props for the client edit modal: ISO strings plus text, nothing else.
export type EditableBooking = {
  id: string;
  startsAt: string; // ISO 8601
  endsAt: string; // ISO 8601
  bookerName: string;
  satker: string;
  agenda: string;
  roomId: string;
};

// Minutes as "45 menit" / "2 jam" / "1 jam 30 menit" (rounded up, min 1).
export function formatWait(minutes: number): string {
  const m = Math.max(1, Math.ceil(minutes));
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} jam ${rest} menit` : `${h} jam`;
}

export type LogBooking = UpcomingBooking;
