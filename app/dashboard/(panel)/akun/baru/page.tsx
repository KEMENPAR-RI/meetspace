import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createUser } from '@/app/actions/user';
import { requireSuperadmin } from '@/lib/auth/access';
import { BackLink } from '@/app/_components/back-link';
import { UserForm } from '../../../_components/user-form';
import { ListSkeleton, PageHeader, cardClass } from '../../../_components/ui';

export const metadata: Metadata = { title: 'Tambah Akun · Dashboard', robots: { index: false, follow: false } };

export default function NewUserPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat formulir" rows={1} />}>
      <NewUserContent />
    </Suspense>
  );
}

async function NewUserContent() {
  await requireSuperadmin();
  return (
    <div className="mx-auto max-w-xl">
      <BackLink href="/dashboard/akun">Akun</BackLink>
      <PageHeader title="Tambah Akun" description="Penanggung jawab ruangan ditetapkan dari halaman ruangan." />
      <section className={cardClass}>
        <UserForm action={createUser} mode="create" />
      </section>
    </div>
  );
}
