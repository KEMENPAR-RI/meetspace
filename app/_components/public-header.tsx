import { Suspense } from 'react';
import { BrandLogo, loadBrand } from './brand';

// Header for public attendance pages: no admin controls, no internal links.
export function PublicHeader() {
  return (
    <header className="mb-6 flex items-center gap-3 border-b-2 border-secondary pb-4 sm:mb-8">
      <Suspense fallback={<div aria-hidden="true" className="h-12 w-full rounded bg-zinc-100" />}>
        <Brand />
      </Suspense>
    </header>
  );
}

async function Brand() {
  const { appName, institutionName, logoUrl } = await loadBrand();
  return (
    <>
      <BrandLogo src={logoUrl} className="size-10 shrink-0 sm:size-12" />
      <div className="min-w-0">
        <p className="text-base leading-tight font-semibold tracking-tight text-balance text-primary sm:text-lg">
          {institutionName ?? appName}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600 sm:text-sm">Daftar Hadir Rapat</p>
      </div>
    </>
  );
}
