'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Trash2 } from 'lucide-react';
import { deleteUser } from '@/app/actions/user';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { dangerButton } from './ui';

// E3/F3 refusals come back as messages from the server.
export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const onClick = async () => {
    const ok = await confirm({
      title: 'Hapus akun?',
      message: `Akun ${userName} akan dihapus permanen dan dilepas dari semua ruangan.`,
      confirmText: 'Ya, hapus',
      cancelText: 'Kembali',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteUser(userId);
        if (result.ok) router.push('/dashboard/akun');
        else setError(result.message);
      } catch {
        setError('Gagal menghapus akun. Silakan coba lagi.');
      }
    });
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={onClick} disabled={pending} className={dangerButton}>
        <Trash2 className="size-4" />
        {pending ? 'Menghapus…' : 'Hapus akun'}
      </button>
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
