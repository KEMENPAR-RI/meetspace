import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, UserPlus, Users } from 'lucide-react';
import { io } from 'next/cache';
import { isSuperadmin, requireSuperadmin } from '@/lib/auth/access';
import { USER_ROLE_LABELS } from '@/lib/auth/types';
import { listUsers } from '@/lib/user/queries';
import { Badge, EmptyState, ListSkeleton, PageHeader, primaryButton, smallButton } from '../../_components/ui';

export const metadata: Metadata = { title: 'Akun · Dashboard', robots: { index: false, follow: false } };

export default function UsersPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat akun" />}>
      <UsersContent />
    </Suspense>
  );
}

async function UsersContent() {
  const me = await requireSuperadmin();
  await io();
  const users = await listUsers(me);

  return (
    <>
      <PageHeader
        eyebrow="Kelola"
        title="Akun"
        description="Akun pengelola dashboard dan ruangan yang menjadi tanggung jawabnya."
        icon={<Users />}
        actions={
          <Link href="/dashboard/akun/baru" className={primaryButton}>
            <UserPlus className="size-4" />
            Tambah akun
          </Link>
        }
      />
      {users.length === 0 ? (
        <EmptyState icon={<Users />}>Belum ada akun.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daftar akun</caption>
            <thead className="hidden bg-zinc-50 text-xs font-semibold tracking-wide text-zinc-500 uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-3">Nama</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Ruangan</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                // Stacked on mobile, table row from md.
                <tr key={u.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 p-4 md:table-row md:p-0">
                  <td className="min-w-0 md:px-4 md:py-3">
                    <p className="font-medium break-words text-zinc-800">
                      {u.name}
                      {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-zinc-500">(Anda)</span>}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">@{u.username}</p>
                  </td>
                  <td className="row-start-2 md:px-4 md:py-3">
                    <Badge tone={isSuperadmin(u) ? 'brand' : 'neutral'}>{USER_ROLE_LABELS[u.role]}</Badge>
                  </td>
                  <td className="col-span-2 text-xs text-zinc-600 md:col-span-1 md:px-4 md:py-3 md:text-sm">
                    <span className="sr-only md:hidden">Ruangan: </span>
                    {isSuperadmin(u)
                      ? 'Semua ruangan'
                      : u.rooms.length === 0
                        ? '—'
                        : u.rooms.map((r) => r.name).join(', ')}
                  </td>
                  <td className="row-start-2 justify-self-end md:px-4 md:py-3">
                    <Badge tone={u.isActive ? 'success' : 'muted'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
                  </td>
                  <td className="col-start-2 row-start-1 justify-self-end md:px-4 md:py-3 md:text-right">
                    <Link href={`/dashboard/akun/${u.id}`} className={smallButton} aria-label={`Edit akun ${u.name}`}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
