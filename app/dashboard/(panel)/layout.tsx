import { Suspense } from 'react';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import { getCurrentUser, isSuperadmin } from '@/lib/auth/access';
import { USER_ROLE_LABELS } from '@/lib/auth/types';
import { BrandLogo, loadBrand } from '@/app/_components/brand';
import { DashboardNavLinks, type NavItem } from '../_components/dashboard-nav';

const BASE_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Ringkasan' },
  { href: '/dashboard/booking', label: 'Booking' },
  { href: '/dashboard/log', label: 'Log Reservasi' },
];

const SUPERADMIN_ITEMS: NavItem[] = [
  { href: '/dashboard/ruangan', label: 'Ruangan' },
  { href: '/dashboard/akun', label: 'Akun' },
  { href: '/dashboard/pengaturan', label: 'Pengaturan' },
];

// Navigation only; every page/action/route guards itself (layouts are not re-rendered per navigation).
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col font-sans lg:flex-row">
      <aside className="bg-primary text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 lg:px-5 lg:pt-6 lg:pb-6">
          <Suspense fallback={<div aria-hidden="true" className="h-9 w-40 rounded bg-white/10" />}>
            <SidebarBrand />
          </Suspense>
        </div>
        <Suspense fallback={<NavSkeleton />}>
          <Nav />
        </Suspense>
      </aside>

      <main id="content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

async function SidebarBrand() {
  const { appName, logoUrl } = await loadBrand();
  return (
    <>
      {/* White tile keeps any logo visible on every primary color */}
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white p-0.5">
        <BrandLogo src={logoUrl} className="size-8" />
      </span>
      <div className="min-w-0">
        <Link
          href="/dashboard"
          className="block truncate rounded text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          {appName}
        </Link>
        <p className="text-xs text-white/70">Dashboard</p>
      </div>
    </>
  );
}

async function Nav() {
  const user = await getCurrentUser();
  // No session: the page itself redirects to login.
  if (!user) return null;

  const items = isSuperadmin(user) ? [...BASE_ITEMS, ...SUPERADMIN_ITEMS] : BASE_ITEMS;

  return (
    <div className="flex flex-col gap-3 lg:flex-1 lg:gap-0">
      <nav aria-label="Menu dashboard" className="px-3 lg:px-3">
        <DashboardNavLinks items={[...items, { href: '/dashboard/password', label: 'Ganti Password' }]} />
      </nav>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 lg:mt-auto lg:flex-col lg:items-stretch lg:px-5 lg:py-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-white/60">
            @{user.username} · {USER_ROLE_LABELS[user.role]}
          </p>
        </div>
        {/* Plain form: logout works without JS */}
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-white/25 px-3 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-safe:transition-colors"
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}

function NavSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-2 px-4 pb-3 lg:flex-col lg:px-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-9 w-24 rounded-lg bg-white/10 motion-safe:animate-pulse lg:w-full" />
      ))}
    </div>
  );
}
