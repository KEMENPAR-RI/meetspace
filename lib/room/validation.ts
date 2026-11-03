import { z } from 'zod';

import { readCheckbox } from '@/lib/user/validation';
import { isUuid } from '@/lib/uuid';

import { ROOM_LIMITS, type RoomField } from './types';

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const MAX_ADMINS = 50;

const noControl = (v: string) => !CONTROL_CHARS.test(v);

// Empty string -> null.
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter.`)
    .refine(noControl, `${label} mengandung karakter yang tidak valid.`)
    .transform((v) => (v === '' ? null : v));

const capacitySchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    if (!/^\d{1,4}$/.test(v)) {
      ctx.addIssue({ code: 'custom', message: 'Kapasitas harus bilangan bulat 1-1000.' });
      return z.NEVER;
    }
    const n = Number(v);
    if (n < ROOM_LIMITS.capacityMin || n > ROOM_LIMITS.capacityMax) {
      ctx.addIssue({ code: 'custom', message: 'Kapasitas harus bilangan bulat 1-1000.' });
      return z.NEVER;
    }
    return n;
  });

const roomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(ROOM_LIMITS.nameMin, `Nama ruangan minimal ${ROOM_LIMITS.nameMin} karakter.`)
    .max(ROOM_LIMITS.name, `Nama ruangan maksimal ${ROOM_LIMITS.name} karakter.`)
    // Name is single-line: also reject \t \n \r.
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), 'Nama ruangan mengandung karakter yang tidak valid.'),
  building: optionalText('Gedung/Lokasi', ROOM_LIMITS.building),
  floor: optionalText('Lantai', ROOM_LIMITS.floor),
  capacity: capacitySchema,
  facilities: optionalText('Fasilitas', ROOM_LIMITS.facilities),
  isActive: z.boolean(),
  adminIds: z
    .array(z.string().refine(isUuid, 'Penanggung jawab tidak valid.'))
    .max(MAX_ADMINS, `Maksimal ${MAX_ADMINS} penanggung jawab.`),
});

export type RoomInput = z.infer<typeof roomSchema>;

const ROOM_FIELD_LIST: readonly RoomField[] = [
  'name',
  'building',
  'floor',
  'capacity',
  'facilities',
  'isActive',
  'adminIds',
];

export type RoomValues = Partial<Record<RoomField, string | string[]>>;

export type ParseRoomResult =
  | { ok: true; data: RoomInput }
  | { ok: false; fieldErrors: Partial<Record<RoomField, string>>; values: RoomValues };

function readString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : '';
}

export function readRoomValues(formData: FormData): RoomValues {
  return {
    name: readString(formData, 'name'),
    building: readString(formData, 'building'),
    floor: readString(formData, 'floor'),
    capacity: readString(formData, 'capacity'),
    facilities: readString(formData, 'facilities'),
    isActive: readCheckbox(formData, 'isActive') ? '1' : '',
    adminIds: formData.getAll('adminIds').filter((v): v is string => typeof v === 'string'),
  };
}

// `requireAdmin` (create, F2): at least one PJ.
export function parseRoomInput(formData: FormData, { requireAdmin }: { requireAdmin: boolean }): ParseRoomResult {
  const values = readRoomValues(formData);
  const result = roomSchema.safeParse({
    ...values,
    isActive: readCheckbox(formData, 'isActive'),
    adminIds: [...new Set(values.adminIds as string[])].map((id) => id.toLowerCase()),
  });
  const fieldErrors: Partial<Record<RoomField, string>> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && (ROOM_FIELD_LIST as readonly string[]).includes(field)) {
        fieldErrors[field as RoomField] ??= issue.message;
      }
    }
  }
  if (requireAdmin && result.success && result.data.adminIds.length === 0) {
    fieldErrors.adminIds = 'Pilih minimal 1 penanggung jawab.';
  }
  if (!result.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return { ok: true, data: result.data };
}
