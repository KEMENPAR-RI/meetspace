'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteAttendance } from '@/app/actions/attendance';
import { useConfirm } from './confirm-dialog';

export function DeleteAttendeeButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const onClick = async () => {
    const ok = await confirm({
      title: 'Hapus dari daftar hadir?',
      message: 'Entri ini akan dihapus permanen. Tindakan tidak bisa dibatalkan.',
      confirmText: 'Ya, hapus',
      cancelText: 'Kembali',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteAttendance(id);
        if (!result.ok) setError(result.message);
      } catch {
        setError('Gagal menghapus data hadir. Silakan coba lagi.');
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={pending ? 'Menghapus data hadir' : label}
        className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
      >
        <Trash2 className="size-3.5" />
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
