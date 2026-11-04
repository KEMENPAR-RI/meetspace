'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { EditableBooking } from '@/lib/booking/types';
import type { RoomOption } from '@/lib/room/types';
import { EditBookingDialog } from './edit-booking-dialog';

export function EditBookingButton({ booking, rooms }: { booking: EditableBooking & { roomName?: string }; rooms: Pick<RoomOption, 'id' | 'name'>[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
      >
        <Pencil className="size-3.5" />
        Edit
      </button>
      {/* Mounted on demand: one form in the DOM, fresh action state per open. */}
      {open && <EditBookingDialog booking={booking} rooms={rooms} onClose={() => setOpen(false)} />}
    </>
  );
}
