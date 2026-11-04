import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ClipboardCheck,
  LogIn,
  Network,
  Palette,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { io } from 'next/cache';
import { requireSuperadmin } from '@/lib/auth/access';
import { formatDateLabel, formatTime } from '@/lib/booking/time';
import { getAppearance, getAppSettings } from '@/lib/settings/queries';
import { SETTINGS_TAB_LABELS, SETTINGS_TABS, isSettingsTab, type AppSettingsView, type SettingsTab } from '@/lib/settings/types';
import { AppearanceForm } from '../../_components/appearance-form';
import {
  AttendanceSettingsForm,
  LoginSettingsForm,
  OfficeIpSettingsForm,
  ProtectionSettingsForm,
} from '../../_components/settings-form';
import { ListSkeleton, PageHeader } from '../../_components/ui';

export const metadata: Metadata = { title: 'Pengaturan · Dashboard', robots: { index: false, follow: false } };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<ListSkeleton label="Memuat pengaturan" rows={2} />}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SettingsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperadmin();
  await io();
  const { tab: rawTab } = await searchParams;
  const tab: SettingsTab = isSettingsTab(rawTab) ? rawTab : 'tampilan';
  const settings = await getAppSettings();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Sistem"
        title="Pengaturan"
        description={
          settings.updatedAt && settings.updatedByName
            ? `Terakhir diubah oleh ${settings.updatedByName} pada ${formatDateLabel(settings.updatedAt)}, ${formatTime(settings.updatedAt)} WIB.`
            : 'Berlaku untuk semua ruangan.'
        }
        icon={<Settings />}
      />
      <TabNav active={tab} protectionWarning={!settings.recaptchaEnabled} />
      <div className="mt-6">
        <TabPanel tab={tab} settings={settings} />
      </div>
    </div>
  );
}

const TAB_ICONS: Record<SettingsTab, LucideIcon> = {
  tampilan: Palette,
  login: LogIn,
  'ip-kantor': Network,
  'daftar-hadir': ClipboardCheck,
  proteksi: ShieldCheck,
};

// Server links: deep-linkable, survives refresh(); only the active tab is rendered.
function TabNav({ active, protectionWarning }: { active: SettingsTab; protectionWarning: boolean }) {
  return (
    <nav aria-label="Bagian pengaturan" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-zinc-200">
        {SETTINGS_TABS.map((t) => {
          const current = t === active;
          const Icon = TAB_ICONS[t];
          return (
            <li key={t}>
              <Link
                href={`/dashboard/pengaturan?tab=${t}`}
                scroll={false}
                aria-current={current ? 'page' : undefined}
                className={
                  '-mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2.5 text-sm whitespace-nowrap ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors ' +
                  (current
                    ? 'border-primary font-semibold text-primary'
                    : 'border-transparent font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-900')
                }
              >
                <Icon className="size-4" />
                {SETTINGS_TAB_LABELS[t]}
                {t === 'proteksi' && protectionWarning && (
                  <span className="size-1.5 rounded-full bg-amber-500">
                    <span className="sr-only">(reCAPTCHA nonaktif)</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Each form gets only its tab's fields (secret is never part of the view).
async function TabPanel({ tab, settings: s }: { tab: SettingsTab; settings: AppSettingsView }) {
  switch (tab) {
    case 'login':
      return (
        <LoginSettingsForm
          initial={{ loginRateMax: s.loginRateMax, loginIpRateMax: s.loginIpRateMax, loginRateWindowMin: s.loginRateWindowMin }}
        />
      );
    case 'ip-kantor':
      return (
        <OfficeIpSettingsForm
          initial={{ officeIpCheck: s.officeIpCheck, officeAllowedIps: s.officeAllowedIps, trustedIpHeader: s.trustedIpHeader }}
          headerOptions={s.trustedIpHeaderOptions}
        />
      );
    case 'daftar-hadir':
      return (
        <AttendanceSettingsForm
          initial={{
            publicAttendanceMaxPerBooking: s.publicAttendanceMaxPerBooking,
            attendanceDeviceCooldownMin: s.attendanceDeviceCooldownMin,
          }}
        />
      );
    case 'proteksi':
      return (
        <ProtectionSettingsForm
          initial={{
            publicMutationRateMax: s.publicMutationRateMax,
            publicMutationRateWindowMin: s.publicMutationRateWindowMin,
            publicPageRateMax: s.publicPageRateMax,
            publicPageRateWindowMin: s.publicPageRateWindowMin,
            recaptchaEnabled: s.recaptchaEnabled,
            recaptchaSiteKey: s.recaptchaSiteKey,
            recaptchaMinScore: s.recaptchaMinScore,
            recaptchaSecretSet: s.recaptchaSecretSet,
          }}
        />
      );
    default:
      return <AppearanceForm initial={await getAppearance()} />;
  }
}
