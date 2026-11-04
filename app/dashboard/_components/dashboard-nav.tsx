'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string };

// Keyed by href: icon components cannot cross the server → client props boundary.
const NAV_ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/booking': CalendarDays,
  '/dashboard/log': ClipboardList,
  '/dashboard/ruangan': Building2,
  '/dashboard/akun': Users,
  '/dashboard/pengaturan': Settings,
  '/dashboard/password': KeyRound,
};

// Active state only; which items exist is decided server-side by role (G3).
export function DashboardNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = NAV_ICONS[item.href];
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={
                'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-safe:transition-colors ' +
                (active
                  ? 'bg-white/10 text-white before:absolute before:inset-x-3 before:bottom-0 before:h-0.5 before:rounded-full before:bg-secondary lg:before:inset-x-auto lg:before:inset-y-2 lg:before:left-0 lg:before:h-auto lg:before:w-1'
                  : 'text-white/70 hover:bg-white/5 hover:text-white')
              }
            >
              {Icon && <Icon className={`size-5 shrink-0 ${active ? 'text-secondary' : ''}`} />}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
