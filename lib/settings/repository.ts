import { prisma } from '@/lib/prisma';

import { SETTING_KEYS, type SettingRow } from './codec';

// The only module that touches the app_settings key-value table. Values are validated by ./codec.

const LOGO_KEYS = [SETTING_KEYS.logo, SETTING_KEYS.logoMime, SETTING_KEYS.logoUpdatedAt];
// Everything except the logo blob (read on demand by readLogoRows).
const LIGHT_KEYS = Object.values(SETTING_KEYS).filter((k) => k !== SETTING_KEYS.logo);

// DB errors are thrown (never swallowed); missing keys simply are not returned.
export async function readSettingRows(): Promise<SettingRow[]> {
  return prisma.appSetting.findMany({ where: { key: { in: LIGHT_KEYS } }, select: { key: true, value: true } });
}

export async function readLogoRows(): Promise<SettingRow[]> {
  return prisma.appSetting.findMany({ where: { key: { in: LOGO_KEYS } }, select: { key: true, value: true } });
}

// One transaction, one upsert per key (new keys get a fresh uuid id).
export async function writeSettingRows(rows: readonly SettingRow[]): Promise<void> {
  await prisma.$transaction(
    rows.map(({ key, value }) =>
      prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value }, select: { id: true } }),
    ),
  );
}

export async function findUserName(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? null;
}
