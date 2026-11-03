import { Suspense } from 'react';
import Link from 'next/link';
import { loadBrand } from './brand';

// Only admin entry on public pages: one plain text link (I2).
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-6xl px-4 pt-10 pb-6 font-sans sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        <Suspense fallback={<p aria-hidden="true">&nbsp;</p>}>
          <FooterBrand />
        </Suspense>
        <Link
          href="/dashboard/login"
          prefetch={false}
          className="rounded text-zinc-500 underline-offset-2 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Masuk Admin
        </Link>
      </div>
    </footer>
  );
}

async function FooterBrand() {
  const { appName, institutionName } = await loadBrand();
  return <p>{institutionName ? `${appName} · ${institutionName}` : appName}</p>;
}
