import { Suspense } from 'react';
import type { Metadata } from 'next';
import { changeOwnPassword } from '@/app/actions/auth';
import { requireUser } from '@/lib/auth/access';
import { PasswordForm } from '../../_components/password-form';
import { ListSkeleton, PageHeader, cardClass } from '../../_components/ui';

export const metadata: Metadata = { title: 'Ganti Password · Dashboard', robots: { index: false, follow: false } };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat formulir" rows={1} />}>
      <ChangePasswordContent />
    </Suspense>
  );
}

async function ChangePasswordContent() {
  await requireUser();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        eyebrow="Akun saya"
        title="Ganti Password"
        description="Sesi di perangkat lain akan berakhir setelah password diganti."
      />
      <section className={cardClass}>
        <PasswordForm action={changeOwnPassword} mode="own" />
      </section>
    </div>
  );
}
