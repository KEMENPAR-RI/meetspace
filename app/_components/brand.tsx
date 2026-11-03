import { getAppearance } from '@/lib/settings/queries';

const DEFAULT_LOGO = '/images/logo.webp';

// Cached appearance ('use cache' + tag): safe outside <Suspense>, part of the static shell.
export async function loadBrand() {
  return getAppearance();
}

export function BrandLogo({ src, className }: { src: string | null; className: string }) {
  return (
    // Versioned /api/logo URL; next/image would need a localPatterns entry for the query string.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src ?? DEFAULT_LOGO} alt="" width={48} height={48} decoding="async" className={`${className} object-contain`} />
  );
}

// Preset hex values only (validated enum → constant table), so inlining is safe.
export async function ThemeVars() {
  const { colors } = await loadBrand();
  return <style>{`:root{--primary:${colors.primary};--secondary:${colors.secondary};}`}</style>;
}
