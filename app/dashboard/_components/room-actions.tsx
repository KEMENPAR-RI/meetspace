'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Power, PowerOff, Trash2 } from 'lucide-react';
import { deleteRoom, setRoomActive } from '@/app/actions/room';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { dangerButton, secondaryButton } from './ui';

// Status toggle + delete; F3/A4 rules are enforced server-side, messages shown as-is.
export function RoomActions({
  roomId,
  roomName,
  isActive,
  hasBookings,
}: {
  roomId: string;
  roomName: string;
  isActive: boolean;
  hasBookings: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const run = (task: () => Promise<{ ok: true } | { ok: false; message: string }>, onOk: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (result.ok) onOk();
        else setError(result.message);
      } catch {
        setError('Gagal memproses. Silakan coba lagi.');
      }
    });
  };

  const toggle = async () => {
    const ok = await confirm(
      isActive
        ? {
            title: 'Nonaktifkan ruangan?',
            message: `${roomName} tidak tampil di halaman publik dan tidak bisa dibooking. Booking yang ada tetap tersimpan.`,
            confirmText: 'Ya, nonaktifkan',
            cancelText: 'Kembali',
            tone: 'danger',
          }
        : {
            title: 'Aktifkan ruangan?',
            message: `${roomName} akan tampil di halaman publik dan dapat dibooking.`,
            confirmText: 'Ya, aktifkan',
            cancelText: 'Kembali',
          },
    );
    if (ok) run(() => setRoomActive(roomId, !isActive), () => {});
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Hapus ruangan?',
      message: `${roomName} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, hapus',
      cancelText: 'Kembali',
      tone: 'danger',
    });
    if (ok) run(() => deleteRoom(roomId), () => router.push('/dashboard/ruangan'));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={toggle} disabled={pending} className={isActive ? dangerButton : secondaryButton}>
          {isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
          {isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending || hasBookings}
          aria-describedby={hasBookings ? 'delete-room-hint' : undefined}
          className={dangerButton}
        >
          <Trash2 className="size-4" />
          Hapus ruangan
        </button>
      </div>
      {hasBookings && (
        <p id="delete-room-hint" className="text-xs text-zinc-500">
          Ruangan yang sudah punya booking tidak bisa dihapus; nonaktifkan saja.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{error}</span>
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
