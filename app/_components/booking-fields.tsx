import { useCallback, useState, useSyncExternalStore } from 'react';
import { todayInJakarta, toJakartaTimeInput } from '@/lib/booking/time';
import { BOOKING_LIMITS, type BookingField } from '@/lib/booking/types';

const inputClass =
  // text-base on mobile stops iOS focus-zoom; min-w-0 lets native date/time inputs shrink.
  'block w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-xs sm:text-sm ' +
  'placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ' +
  'aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/30';

// iOS Safari: drop native styling (centered text, collapsed height when empty).
const dateTimeClass = `${inputClass} min-h-10.5 appearance-none sm:min-h-9.5 [&::-webkit-date-and-time-value]:text-left`;

type Props = {
  // Keeps ids unique when two forms are on the page ('' for create, 'edit-' for edit).
  idPrefix: string;
  values: Partial<Record<BookingField, string>>;
  errors: Partial<Record<BookingField, string>>;
  // Edit mode: the saved date/start stay valid even if already past.
  original?: { date: string; startTime: string };
};

type TextFieldsProps = Omit<Props, 'original'>;

// Client-only clock so `new Date()` stays out of the prerendered shell.
const subscribeClock = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};
// Earliest valid start is the next minute (server rejects start <= now); at 23:59 that is tomorrow,
// so date and time both come from it and today drops out of the date `min`.
const getClock = () => {
  const next = new Date(Date.now() + 60_000);
  return `${todayInJakarta(next)} ${toJakartaTimeInput(next)}`;
};
const getServerClock = () => '';

type Picked = { date: string; startTime: string };

function readPicked(form: HTMLFormElement): Picked {
  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
  return { date: value('date'), startTime: value('startTime') };
}

// Blocks past dates/times client-side; the server re-validates.
function usePastLimits(values: Props['values'], original: Props['original']) {
  const [picked, setPicked] = useState<Picked>({
    date: values.date ?? '',
    startTime: values.startTime ?? '',
  });

  // React resets the form after an action without firing onChange; re-read the DOM.
  const watchReset = useCallback((el: HTMLInputElement | null) => {
    const form = el?.form;
    if (!form) return;
    const onReset = () => setTimeout(() => setPicked(readPicked(form)));
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, []);

  const clock = useSyncExternalStore(subscribeClock, getClock, getServerClock);
  if (!clock) return { picked, setPicked, watchReset };

  const [today, nextMinute] = clock.split(' ');
  const isToday = picked.date === today;
  const startUnchanged =
    !!original && picked.date === original.date && picked.startTime === original.startTime;
  const startMin = isToday && !startUnchanged ? nextMinute : undefined;
  const endFloor = isToday ? nextMinute : '';

  return {
    picked,
    setPicked,
    watchReset,
    minDate: original && original.date < today ? original.date : today,
    startMin,
    endMin: (picked.startTime > endFloor ? picked.startTime : endFloor) || undefined,
  };
}

// Shared a11y + error wiring for each field.
function fieldWiring({ idPrefix, values, errors }: TextFieldsProps) {
  const fieldId = (name: BookingField) => `${idPrefix}${name}`;
  const fieldProps = (name: BookingField) => ({
    id: fieldId(name),
    name,
    defaultValue: values[name],
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${fieldId(name)}-error` : undefined,
  });
  return { fieldId, fieldProps };
}

// Shared booking inputs; `name` attributes stay equal to BOOKING_FIELDS.
export function BookingFields({ original, ...props }: Props) {
  const { errors } = props;
  const { fieldId, fieldProps } = fieldWiring(props);
  const { setPicked, watchReset, minDate, startMin, endMin } = usePastLimits(props.values, original);

  return (
    <>
      <Field label="Tanggal" id={fieldId('date')} error={errors.date}>
        <input
          ref={watchReset}
          type="date"
          required
          min={minDate}
          className={dateTimeClass}
          onChange={(e) => {
            const date = e.currentTarget.value;
            setPicked((p) => ({ ...p, date }));
          }}
          {...fieldProps('date')}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
        <Field label="Jam Mulai" id={fieldId('startTime')} error={errors.startTime}>
          <input
            type="time"
            required
            min={startMin}
            className={dateTimeClass}
            onChange={(e) => {
              const startTime = e.currentTarget.value;
              setPicked((p) => ({ ...p, startTime }));
            }}
            {...fieldProps('startTime')}
          />
        </Field>
        <Field label="Jam Akhir" id={fieldId('endTime')} error={errors.endTime}>
          <input
            type="time"
            required
            min={endMin}
            className={dateTimeClass}
            {...fieldProps('endTime')}
          />
        </Field>
      </div>

      <BookingTextFields {...props} />
    </>
  );
}

// Name, satker and agenda only (text-only edit of finished bookings).
export function BookingTextFields(props: TextFieldsProps) {
  const { errors } = props;
  const { fieldId, fieldProps } = fieldWiring(props);

  return (
    <>
      <Field label="Nama Pemesan" id={fieldId('bookerName')} error={errors.bookerName}>
        <input
          type="text"
          required
          maxLength={BOOKING_LIMITS.bookerName}
          autoComplete="name"
          className={inputClass}
          {...fieldProps('bookerName')}
        />
      </Field>

      <Field label="Satker/Instansi" id={fieldId('satker')} error={errors.satker}>
        <input
          type="text"
          required
          maxLength={BOOKING_LIMITS.satker}
          autoComplete="organization"
          className={inputClass}
          {...fieldProps('satker')}
        />
      </Field>

      <Field label="Keperluan / Agenda" id={fieldId('agenda')} error={errors.agenda}>
        <textarea
          required
          rows={4}
          maxLength={BOOKING_LIMITS.agenda}
          className={`${inputClass} resize-y`}
          {...fieldProps('agenda')}
        />
      </Field>
    </>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
