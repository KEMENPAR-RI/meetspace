'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { cancelBooking } from '@/app/actions/booking';
import { deletePastBooking } from '@/app/actions/log';
import type { LogDay, LogEntry } from '@/lib/booking/log';
import { APP_TZ_LABEL, formatDateLabel, getBookingStatus, toInstant } from '@/lib/booking/time';
import { useConfirm } from './confirm-dialog';
import type { RoomOption } from '@/lib/room/types';
import { EditBookingDialog } from './edit-booking-dialog';
import { EditPastBookingDialog } from './edit-past-booking-dialog';
import { StatusBadge } from './status-badge';

type Props = { day: LogDay | null; rooms: Pick<RoomOption, 'id' | 'name'>[]; onClose: () => void };

export function DayDetailDialog({ day, rooms, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Mode (past/upcoming) decided at click time, so it tracks the current clock.
  const [editing, setEditing] = useState<{ entry: LogEntry; past: boolean } | null>(null);

  const openDialog = useCallback((el: HTMLDialogElement | null) => {
    dialogRef.current = el;
    if (el && !el.open) el.showModal();
  }, []);

  // close() restores focus to the day button; the `close` event then unmounts us.
  const close = () => dialogRef.current?.close();

  // Day emptied (delete, or edit moved it): close; LogView then focuses the heading,
  // since the day button became a <span> and the native focus restore has no target.
  const empty = day?.entries.length === 0;
  useEffect(() => {
    if (empty) dialogRef.current?.close();
  }, [empty]);

  // Edited entry moved to another day: its Edit button is gone, keep focus in this dialog.
  const closeEdit = () => {
    setEditing(null);
    const el = dialogRef.current;
    // Nested edit dialog is a DOM child, so check the nearest dialog instead of contains().
    if (el?.open && document.activeElement?.closest('dialog') !== el) closeRef.current?.focus();
  };

  if (!day) return null;

  const entries = [...day.entries].sort((a, b) => a.startISO.localeCompare(b.startISO));

  return (
    <dialog
      ref={openDialog}
      // React bubbles `close` from the nested edit dialog; only react to our own.
      onClose={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
      aria-labelledby="day-detail-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-left text-zinc-900 shadow-lg backdrop:bg-primary/40 sm:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="day-detail-title" className="text-lg font-semibold text-primary">
            {formatDateLabel(toInstant(day.dateKey, '00:00'))}
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600">{day.count} reservasi</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Tutup"
          className="-m-1 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Tidak ada reservasi pada tanggal ini
        </p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="rounded-xl border border-zinc-200 border-l-4 border-l-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <p className="text-sm font-semibold text-primary tabular-nums">
                  <time dateTime={e.startISO}>{e.startLabel}</time>–
                  <time dateTime={e.endISO}>{e.endLabel}</time> {APP_TZ_LABEL}
                </p>
                {/* Client-only dialog (opened by click), so reading the clock here can't mismatch SSR */}
                <StatusBadge
                  startsAt={e.startISO}
                  endsAt={e.endISO}
                  initialStatus={getBookingStatus(new Date(e.startISO), new Date(e.endISO), new Date())}
                />
              </div>
              <p className="mt-1.5 text-sm text-zinc-600">
                <span className="font-medium text-zinc-800">{e.bookerName}</span>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">Satker/Instansi: </span>
                {e.satker}
              </p>
              <p className="mt-0.5 text-xs font-medium text-zinc-500">
                <span className="sr-only">Ruangan: </span>
                {e.roomName}
              </p>
              {/* Plain text only; line breaks kept via CSS */}
              <p className="mt-2 whitespace-pre-line break-words text-sm text-zinc-700">{e.agenda}</p>
              <div className="mt-3 flex flex-wrap items-start justify-end gap-2">
                <span className="mr-auto self-center rounded-full bg-secondary/40 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                  {e.attendeeCount} hadir
                </span>
                <Link
                  href={`/dashboard/rapat/${e.id}`}
                  aria-label={`Daftar hadir reservasi ${e.bookerName} ${e.startLabel}–${e.endLabel}`}
                  className="rounded-md border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
                >
                  Daftar hadir
                </Link>
                <button
                  type="button"
                  onClick={() => setEditing({ entry: e, past: Date.parse(e.endISO) <= Date.now() })}
                  aria-haspopup="dialog"
                  aria-label={`Edit reservasi ${e.bookerName} ${e.startLabel}–${e.endLabel}`}
                  className="rounded-md border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
                >
                  Edit
                </button>
                <DeleteEntryButton
                  id={e.id}
                  endISO={e.endISO}
                  label={`Hapus reservasi ${e.bookerName} ${e.startLabel}–${e.endLabel}`}
                  onDeleted={() => closeRef.current?.focus()}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={close}
          className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors sm:w-auto"
        >
          Tutup
        </button>
      </div>

      {/* Mounted on demand; nested showModal stacks above this dialog. */}
      {editing &&
        (editing.past ? (
          <EditPastBookingDialog entry={editing.entry} onClose={closeEdit} />
        ) : (
          <EditBookingDialog
            booking={{
              id: editing.entry.id,
              startsAt: editing.entry.startISO,
              endsAt: editing.entry.endISO,
              bookerName: editing.entry.bookerName,
              satker: editing.entry.satker,
              agenda: editing.entry.agenda,
              roomId: editing.entry.roomId,
              roomName: editing.entry.roomName,
            }}
            rooms={rooms}
            onClose={closeEdit}
          />
        ))}
    </dialog>
  );
}

// Finished → deletePastBooking, otherwise → cancelBooking; both actions re-check access + status.
function DeleteEntryButton({
  id,
  endISO,
  label,
  onDeleted,
}: {
  id: string;
  endISO: string;
  label: string;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const onClick = async () => {
    const past = Date.parse(endISO) <= Date.now();
    const ok = await confirm({
      title: past ? 'Hapus dari log?' : 'Batalkan reservasi?',
      message: past
        ? 'Hapus reservasi ini dari log? Tindakan tidak bisa dibatalkan.'
        : 'Batalkan & hapus reservasi ini? Tindakan tidak bisa dibatalkan.',
      confirmText: past ? 'Ya, hapus' : 'Ya, batalkan & hapus',
      cancelText: 'Kembali',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result: { ok: boolean; message?: string } = past
          ? await deletePastBooking(id)
          : await cancelBooking(id);
        if (!result.ok) setError(result.message ?? 'Gagal menghapus reservasi.');
        else onDeleted(); // row unmounts on refresh; keep focus inside the dialog
      } catch {
        setError('Gagal menghapus reservasi. Silakan coba lagi.');
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={pending ? 'Menghapus reservasi' : label}
        className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
      >
        {pending ? 'Menghapus…' : 'Hapus'}
      </button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-red-600">
          {error}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
