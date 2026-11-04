import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, LogIn } from 'lucide-react';
import { io } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/access';
import { getRecaptchaSiteKey } from '@/lib/settings/recaptcha';
import { BrandLogo, loadBrand } from '@/app/_components/brand';
import { LoginForm } from '../_components/login-form';

export const metadata: Metadata = {
  title: 'Masuk Dashboard',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-primary px-4 py-10 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex min-h-12 items-center gap-3 text-white">
          <Suspense fallback={null}>
            <LoginBrand />
          </Suspense>
        </div>

        <section
          aria-labelledby="login-heading"
          className="rounded-2xl border-t-4 border-secondary bg-white p-6 shadow-xl sm:p-7"
        >
          <h1 id="login-heading" className="mb-5 flex items-center gap-2 text-xl font-semibold text-primary">
            <LogIn className="size-5" />
            Masuk
          </h1>
          <Suspense fallback={<FormSkeleton />}>
            <LoginGate />
          </Suspense>
        </section>

        <Link
          href="/"
          prefetch={false}
          className="mt-5 inline-flex items-center gap-1 rounded text-sm text-white/80 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <ArrowLeft className="size-4" />
          Kembali ke halaman booking
        </Link>
      </div>
    </main>
  );
}

async function LoginBrand() {
  const { appName, institutionName, logoUrl } = await loadBrand();
  return (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white p-1">
        <BrandLogo src={logoUrl} className="size-10" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight break-words">{appName}</p>
        <p className="text-xs break-words text-white/80">{institutionName ?? 'Dashboard pengelola ruang rapat'}</p>
      </div>
    </>
  );
}

// Already signed in → straight to the dashboard.
async function LoginGate() {
  if (await getCurrentUser()) redirect('/dashboard');
  // Defer the clock read inside the settings cache; never swallow errors here: a form rendered without the
  // site key would send no token and be rejected by the server.
  await io();
  const recaptchaSiteKey = await getRecaptchaSiteKey();
  return <LoginForm recaptchaSiteKey={recaptchaSiteKey} />;
}

function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat formulir" className="space-y-5">
      <div className="h-16 rounded-lg bg-zinc-100 motion-safe:animate-pulse" />
      <div className="h-16 rounded-lg bg-zinc-100 motion-safe:animate-pulse" />
      <div className="h-10 rounded-lg bg-zinc-200 motion-safe:animate-pulse" />
    </div>
  );
}
