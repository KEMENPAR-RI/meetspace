import { Suspense } from 'react';
import { BrandLogo, loadBrand } from './brand';

// Public header: no login or admin controls (I1). Branding streams from settings.
export function SiteHeader() {
  return (
    <header className="mb-8 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b-2 border-secondary pb-4 sm:items-center sm:gap-y-0">
      <Suspense fallback={<HeaderFallback />}>
        <HeaderBrand />
      </Suspense>
      <p className="col-span-2 mt-1 text-xs text-pretty text-zinc-600 sm:col-span-1 sm:col-start-2 sm:text-sm sm:text-wrap">
        Booking ruang rapat secara online untuk mempermudah proses reservasi dan mengurangi antrian di lokasi.
      </p>
    </header>
  );
}

async function HeaderBrand() {
  const { appName, institutionName, logoUrl } = await loadBrand();
  return (
    <>
      <BrandLogo src={logoUrl} className="size-10 shrink-0 sm:row-span-2 sm:size-12" />
      <h1 className="min-w-0 text-lg leading-tight font-semibold tracking-tight break-words text-balance text-primary sm:text-3xl sm:leading-9 sm:text-wrap">
        {institutionName ?? appName}
      </h1>
    </>
  );
}

function HeaderFallback() {
  return (
    <>
      <div aria-hidden="true" className="size-10 shrink-0 rounded bg-zinc-100 sm:row-span-2 sm:size-12" />
      <div aria-hidden="true" className="h-7 w-64 max-w-full rounded bg-zinc-100 sm:h-9" />
    </>
  );
}
