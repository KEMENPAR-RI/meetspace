'use client';

import { startTransition, useActionState, useCallback, useEffect, useId, useRef } from 'react';
import { CircleAlert, LoaderCircle, Save, X } from 'lucide-react';
import { updatePastBookingText } from '@/app/actions/log';
import type { LogEntry } from '@/lib/booking/log';
import { APP_TZ_LABEL, formatDateLabel, toInstant } from '@/lib/booking/time';
import { initialBookingFormState } from '@/lib/booking/types';
import { BookingTextFields } from './booking-fields';
import { useConfirm } from './confirm-dialog';

type Props = { entry: LogEntry; onClose: () => void };

// Finished bookings: only name/satker/agenda are editable; date & time are shown read-only.
export function EditPastBookingDialog({ entry, onClose }: Props) {
  const id = useId();
  // Bound id is untrusted client input; the action re-checks access + finished.
  const [state, formAction, pending] = useActionState(
    updatePastBookingText.bind(null, entry.id),
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

  const initial = { bookerName: entry.bookerName, satker: entry.satker, agenda: entry.agenda };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget); // capture before awaiting
    const ok = await confirm({
      title: 'Simpan perubahan?',
      message: 'Data reservasi akan diperbarui.',
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
          if (pending) e.preventDefault();
        }}
        aria-labelledby={`${id}-title`}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-left text-zinc-900 shadow-lg backdrop:bg-primary/40 sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-primary">
            Ubah Data Reservasi
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

        {/* Read-only: not form fields, so they are never submitted. */}
        <div className="mb-5 rounded-xl bg-zinc-50 px-4 py-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-zinc-500">Tanggal</dt>
            <dd className="font-medium text-zinc-800">
              {formatDateLabel(toInstant(entry.dateKey, '00:00'))}
            </dd>
            <dt className="text-zinc-500">Waktu</dt>
            <dd className="font-medium text-zinc-800 tabular-nums">
              <time dateTime={entry.startISO}>{entry.startLabel}</time>–
              <time dateTime={entry.endISO}>{entry.endLabel}</time> {APP_TZ_LABEL}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">
            Reservasi sudah selesai; tanggal dan jam tidak dapat diubah.
          </p>
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

          <BookingTextFields
            idPrefix="edit-past-"
            values={{ ...initial, ...state.values }}
            errors={state.fieldErrors ?? {}}
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
      {confirmDialog}
    </>
  );
}
