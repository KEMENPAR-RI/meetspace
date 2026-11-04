'use client';

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { cancelBooking } from '@/app/actions/booking';
import { useConfirm } from './confirm-dialog';

export function CancelButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const onClick = async () => {
    const ok = await confirm({
      title: 'Batalkan booking?',
      message: 'Booking akan dihapus permanen.',
      confirmText: 'Ya, batalkan',
      cancelText: 'Kembali',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await cancelBooking(id);
        if (!result.ok) setError(result.message);
      } catch {
        // Network/server failure; keep the page usable.
        setError('Gagal membatalkan booking. Silakan coba lagi.');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors"
      >
        <X className="size-3.5" />
        {pending ? 'Membatalkan…' : 'Batal'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {confirmDialog}
    </div>
  );
}
