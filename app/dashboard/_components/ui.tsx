import type { FormState } from '@/lib/auth/types';

// Shared dashboard styles + small presentational pieces (server- and client-safe).

export const inputClass =
  'block w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-xs sm:text-sm ' +
  'placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 ' +
  'aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/30 disabled:bg-zinc-50 disabled:text-zinc-500';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const primaryButton =
  `inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 ${focusRing} ` +
  'disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors';

export const secondaryButton =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 ${focusRing} ` +
  'disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors';

export const smallButton =
  `inline-flex items-center justify-center gap-1 rounded-md border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5 ${focusRing} ` +
  'disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors';

export const dangerButton =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-colors';

export const cardClass = 'rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6';

// Dashboard forms share the backend FormState contract.
export type UiFormState = FormState;

export function FormMessage({ state }: { state: Pick<UiFormState, 'status' | 'message'> }) {
  if (state.status === 'idle' || !state.message) return null;
  const error = state.status === 'error';
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={
        error
          ? 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
          : 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
      }
    >
      {state.message}
    </p>
  );
}

export function Field({
  label,
  id,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
        {optional && <span className="ml-1 font-normal text-zinc-500">(opsional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// aria wiring for an input inside <Field>.
export function fieldAria(id: string, error?: string, hint?: boolean) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const;
}

export function readValue(values: UiFormState['values'], name: string): string | undefined {
  const v = values?.[name];
  return Array.isArray(v) ? v[0] : v;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{eyebrow}</p>}
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight break-words text-primary">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500"
    >
      {children}
    </p>
  );
}

export function ListSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-3">
      <div className="h-7 w-48 rounded bg-zinc-200 motion-safe:animate-pulse" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-24 rounded-xl border border-zinc-200 bg-white motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'brand' | 'muted';
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'border-zinc-200 bg-zinc-50 text-zinc-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
    brand: 'border-secondary bg-secondary/30 text-primary',
    muted: 'border-transparent bg-slate-100 text-slate-500',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
