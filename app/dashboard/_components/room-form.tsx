'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import { initialFormState } from '@/lib/auth/types';
import { ROOM_LIMITS as LIMITS, type AssignableAdmin } from '@/lib/room/types';
import { Field, FormMessage, fieldAria, inputClass, primaryButton, readValue, type UiFormState } from './ui';

export type RoomFormInitial = {
  name: string;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  facilities: string | null;
  isActive: boolean;
  adminIds: string[];
};

type Props = {
  action: (state: UiFormState, formData: FormData) => Promise<UiFormState>;
  initial?: RoomFormInitial;
  admins: AssignableAdmin[];
  // Room being edited; admins holding it stay selectable.
  roomId?: string;
  submitLabel: string;
};

export function RoomForm({ action, initial, admins, roomId, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  // After a failed submit, show what the user typed (A2); otherwise the saved data.
  const submitted = state.status === 'error' ? state.values : undefined;
  const text = (name: 'name' | 'building' | 'floor' | 'facilities' | 'capacity', fallback: string | number | null | undefined) =>
    submitted ? (readValue(submitted, name) ?? '') : (fallback ?? '').toString();
  const isActive = submitted ? readValue(submitted, 'isActive') === '1' : (initial?.isActive ?? true);
  const pickedIds = submitted ? toArray(submitted.adminIds) : (initial?.adminIds ?? []);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <Field label="Nama ruangan" id="room-name" error={errors.name}>
        <input
          name="name"
          type="text"
          required
          minLength={LIMITS.nameMin}
          maxLength={LIMITS.name}
          defaultValue={text('name', initial?.name)}
          className={inputClass}
          {...fieldAria('room-name', errors.name)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:gap-4">
        <Field label="Gedung / Lokasi" id="room-building" error={errors.building} optional>
          <input
            name="building"
            type="text"
            maxLength={LIMITS.building}
            defaultValue={text('building', initial?.building)}
            className={inputClass}
            {...fieldAria('room-building', errors.building)}
          />
        </Field>
        <Field label="Lantai" id="room-floor" error={errors.floor} optional>
          <input
            name="floor"
            type="text"
            maxLength={LIMITS.floor}
            placeholder="3, B1…"
            defaultValue={text('floor', initial?.floor)}
            className={inputClass}
            {...fieldAria('room-floor', errors.floor)}
          />
        </Field>
        <Field label="Kapasitas" id="room-capacity" error={errors.capacity} optional>
          <input
            name="capacity"
            type="number"
            inputMode="numeric"
            min={LIMITS.capacityMin}
            max={LIMITS.capacityMax}
            step={1}
            defaultValue={text('capacity', initial?.capacity)}
            className={`${inputClass} tabular-nums`}
            {...fieldAria('room-capacity', errors.capacity)}
          />
        </Field>
      </div>

      <Field label="Fasilitas" id="room-facilities" error={errors.facilities} optional hint="Mis. proyektor, TV, video conference.">
        <textarea
          name="facilities"
          rows={3}
          maxLength={LIMITS.facilities}
          defaultValue={text('facilities', initial?.facilities)}
          className={`${inputClass} resize-y`}
          {...fieldAria('room-facilities', errors.facilities, true)}
        />
      </Field>

      <fieldset
        className="space-y-2"
        aria-describedby={errors.adminIds ? 'room-admins-error' : 'room-admins-hint'}
        aria-invalid={errors.adminIds ? true : undefined}
      >
        <legend className="text-sm font-medium text-zinc-800">Penanggung jawab</legend>
        <p id="room-admins-hint" className="text-xs text-zinc-500">
          Minimal satu akun admin aktif. Satu admin hanya dapat memegang satu ruangan.
        </p>
        {admins.length === 0 ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Belum ada akun admin aktif.{' '}
            <Link href="/dashboard/akun/baru" className="font-semibold underline underline-offset-2">
              Buat akun admin
            </Link>{' '}
            terlebih dahulu.
          </p>
        ) : (
          <ul className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-zinc-200 p-2 sm:grid-cols-2">
            {admins.map((a) => {
              // Server rejects it too ("Admin sudah ditugaskan di ruangan lain.").
              const elsewhere = a.room && a.room.id !== roomId ? a.room : null;
              return (
                <li key={a.id}>
                  <label
                    className={`flex items-start gap-2.5 rounded-md px-2 py-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${elsewhere ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-zinc-50'}`}
                  >
                    <input
                      type="checkbox"
                      name="adminIds"
                      value={a.id}
                      disabled={Boolean(elsewhere)}
                      defaultChecked={!elsewhere && pickedIds.includes(a.id)}
                      className="mt-0.5 size-4 rounded border-zinc-300 accent-primary"
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium break-words text-zinc-800">{a.name}</span>
                      <span className="block text-xs text-zinc-500">
                        @{a.username}
                        {elsewhere && <> · sudah di {elsewhere.name}</>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {errors.adminIds && (
          <p id="room-admins-error" className="text-sm text-red-600">
            {errors.adminIds}
          </p>
        )}
      </fieldset>

      <div className="space-y-1">
        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            name="isActive"
            value="1"
            defaultChecked={isActive}
            className="size-4 rounded border-zinc-300 accent-primary"
            aria-describedby="room-active-hint"
          />
          Aktif (tampil di halaman publik dan dapat dibooking)
        </label>
        <p id="room-active-hint" className="pl-6.5 text-xs text-zinc-500">
          Ruangan nonaktif tidak bisa dibooking; booking lama tetap tersimpan.
        </p>
        {errors.isActive && <p className="text-sm text-red-600">{errors.isActive}</p>}
      </div>

      <div className="flex justify-end border-t border-zinc-100 pt-5">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <Save className="size-4" />}
          {pending ? 'Menyimpan…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
