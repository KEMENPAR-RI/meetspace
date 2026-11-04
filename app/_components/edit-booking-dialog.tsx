'use client';

import { startTransition, useActionState, useCallback, useEffect, useRef } from 'react';
import { CircleAlert, LoaderCircle, Save, X } from 'lucide-react';
import { updateBooking } from '@/app/actions/booking';
import { initialBookingFormState, type EditableBooking } from '@/lib/booking/types';
import type { RoomOption } from '@/lib/room/types';
import { toJakartaDateString, toJakartaTimeInput } from '@/lib/booking/time';
import { BookingFields } from './booking-fields';
import { useConfirm } from './confirm-dialog';

// rooms: active rooms in the user's scope (H3); server re-checks both source and target.
// roomName labels the current room when it is no longer an allowed target.
type Props = {
  booking: EditableBooking & { roomName?: string };
  rooms: Pick<RoomOption, 'id' | 'name'>[];
  onClose: () => void;
};

export function EditBookingDialog({ booking, rooms, onClose }: Props) {
  // Bound id is untrusted client input; the action re-checks access + id.
  const [state, formAction, pending] = useActionState(
    updateBooking.bind(null, booking.id),
    initialBookingFormState,
  );
  const { confirm, confirmDialog } = useConfirm();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const openDialog = useCallback((el: HTMLDialogElement | null) => {
    dialogRef.current = el;
    if (el && !el.open) el.showModal();
  }, []);

  // close() restores focus to the Edit button; the `close` event then unmounts us.
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    if (state.status === 'success') dialogRef.current?.close();
  }, [state.status]);

  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const initial = {
    date: toJakartaDateString(start),
    startTime: toJakartaTimeInput(start),
    endTime: toJakartaTimeInput(end),
    bookerName: booking.bookerName,
    satker: booking.satker,
    agenda: booking.agenda,
  };
  const roomError = state.fieldErrors?.roomId;
  const roomValue = state.values?.roomId ?? booking.roomId;
  // Current room may be inactive now; keep it selectable so a text-only edit still works.
  const roomOptions = rooms.some((r) => r.id === booking.roomId)
    ? rooms
    : [{ id: booking.roomId, name: booking.roomName ?? 'Ruangan saat ini' }, ...rooms];

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); // capture before awaiting
    const ok = await confirm({
      title: 'Simpan perubahan?',
      message: 'Data booking akan diperbarui.',
      confirmText: 'Ya, simpan',
      cancelText: 'Kembali',
    });
    if (!ok) return;
    startTransition(() => formAction(fd));
  };

  return (
    <>
      <dialog
        ref={openDialog}
        onClose={onClose}
        onCancel={(e) => {
          // Keep the dialog open while saving so a clash/not-found error isn't lost.
          if (pending) e.preventDefault();
        }}
        aria-labelledby="edit-booking-title"
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-left text-zinc-900 shadow-lg backdrop:bg-primary/40 sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id="edit-booking-title" className="text-lg font-semibold text-primary">
            Ubah Booking
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            aria-label="Tutup"
            className="-m-1 rounded-md p-1 disabled:cursor-not-allowed disabled:opacity-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        <form action={formAction} onSubmit={onSubmit} className="space-y-5">
          {state.status === 'error' && state.message && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">{state.message}</span>
            </p>
          )}

          <div className="min-w-0 space-y-1.5">
            <label htmlFor="edit-roomId" className="block text-sm font-medium text-zinc-800">
              Ruangan
            </label>
            <select
              id="edit-roomId"
              name="roomId"
              required
              defaultValue={roomValue}
              aria-invalid={roomError ? true : undefined}
              aria-describedby={roomError ? 'edit-roomId-error' : undefined}
              className="block w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 aria-invalid:border-red-500 sm:text-sm"
            >
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {roomError && (
              <p id="edit-roomId-error" className="text-sm text-red-600">
                {roomError}
              </p>
            )}
          </div>

          <BookingFields
            idPrefix="edit-"
            values={{ ...initial, ...state.values }}
            errors={state.fieldErrors ?? {}}
            original={{ date: initial.date, startTime: initial.startTime }}
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
            >
              {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <Save className="size-4" />}
              {pending ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </dialog>
      {/* Sibling of the dialog so its events don't bubble into this form/dialog. */}
      {confirmDialog}
    </>
  );
}
