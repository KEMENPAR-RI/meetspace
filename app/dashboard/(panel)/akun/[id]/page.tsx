import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, Trash2, UserRound } from 'lucide-react';
import { notFound } from 'next/navigation';
import { io } from 'next/cache';
import { resetUserPassword, updateUser } from '@/app/actions/user';
import { requireSuperadmin } from '@/lib/auth/access';
import { isBookingId } from '@/lib/booking/validation';
import { getUserForEdit } from '@/lib/user/queries';
import { BackLink } from '@/app/_components/back-link';
import { DeleteUserButton } from '../../../_components/delete-user-button';
import { PasswordForm } from '../../../_components/password-form';
import { UserForm } from '../../../_components/user-form';
import { ListSkeleton, PageHeader, cardClass } from '../../../_components/ui';

export const metadata: Metadata = { title: 'Edit Akun · Dashboard', robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default function EditUserPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat akun" rows={2} />}>
      <EditUserContent params={params} />
    </Suspense>
  );
}

async function EditUserContent({ params }: { params: Params }) {
  const me = await requireSuperadmin();
  const { id } = await params;
  // User ids are UUIDs like booking ids.
  if (!isBookingId(id)) notFound();

  await io();
  const user = await getUserForEdit(me, id);
  if (!user) notFound();
  const self = user.id === me.id;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <BackLink href="/dashboard/akun">Akun</BackLink>
      <PageHeader
        eyebrow="Edit akun"
        title={user.name}
        icon={<UserRound />}
        description={<span className="font-mono">@{user.username}</span>}
      />

      <section aria-label="Data akun" className={cardClass}>
        <UserForm
          action={updateUser.bind(null, user.id)}
          mode="edit"
          initial={{ name: user.name, username: user.username, role: user.role, isActive: user.isActive }}
        />
        {user.role === 'ADMIN' && (
          <p className="mt-4 text-xs text-zinc-500">
            Ruangan: {user.rooms.length === 0 ? 'belum ada' : user.rooms.map((r) => r.name).join(', ')}. Ubah
            penugasan dari{' '}
            <Link href="/dashboard/ruangan" className="font-medium text-primary underline underline-offset-2">
              halaman ruangan
            </Link>
            .
          </p>
        )}
      </section>

      <section aria-labelledby="reset-heading" className={cardClass}>
        <h2 id="reset-heading" className="mb-1 flex items-center gap-2 text-base font-semibold text-primary">
          <KeyRound className="size-5" />
          Reset password
        </h2>
        <p className="mb-4 text-sm text-zinc-600">Semua sesi akun ini akan berakhir setelah password direset.</p>
        {self ? (
          <p className="text-sm text-zinc-600">
            Untuk akun Anda sendiri, gunakan{' '}
            <Link href="/dashboard/password" className="font-medium text-primary underline underline-offset-2">
              Ganti Password
            </Link>
            .
          </p>
        ) : (
          <PasswordForm action={resetUserPassword.bind(null, user.id)} mode="reset" />
        )}
      </section>

      {!self && (
        <section aria-labelledby="delete-heading" className={`${cardClass} border-red-200`}>
          <h2 id="delete-heading" className="mb-3 flex items-center gap-2 text-base font-semibold text-red-800">
            <Trash2 className="size-5" />
            Hapus akun
          </h2>
          <DeleteUserButton userId={user.id} userName={user.name} />
        </section>
      )}
    </div>
  );
}
