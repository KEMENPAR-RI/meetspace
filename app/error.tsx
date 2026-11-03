'use client';

import { APP_MAINTAINER } from '@/lib/maintainer';

// Shows only error.digest; error.message may leak server details.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center font-sans">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Terjadi kesalahan</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
        Halaman gagal dimuat
      </h1>
      <p className="mt-3 text-sm text-zinc-600">
        Silakan coba lagi. Jika masalah berlanjut, hubungi tim {APP_MAINTAINER}.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-zinc-500">
          Kode referensi: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
      >
        Coba lagi
      </button>
    </main>
  );
}
