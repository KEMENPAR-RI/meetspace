type Props = { searchParams: string; disabled?: boolean; endpoint?: string; label?: string };

const linkClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 text-sm font-medium text-primary ' +
  'hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors';

const FORMATS = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
] as const;

// Plain anchors: the route streams an attachment, no client navigation.
export function ExportButtons({
  searchParams,
  disabled = false,
  endpoint = '/api/log/export',
  label = 'Ekspor log sesuai filter aktif',
}: Props) {
  const suffix = searchParams ? `&${searchParams}` : '';
  const hint = 'Persempit filter untuk mengekspor';

  return (
    <div
      role="group"
      aria-label={disabled ? `Ekspor tidak tersedia. ${hint}` : label}
      title={disabled ? hint : undefined}
      className="flex items-center gap-2"
    >
      <span className="hidden text-xs text-zinc-500 sm:inline">{disabled ? hint : 'Ekspor'}</span>
      {FORMATS.map(({ format, label: text }) => (
        // No href when disabled: the route would answer 413 and `download` would save the JSON.
        <a
          key={format}
          href={disabled ? undefined : `${endpoint}?format=${format}${suffix}`}
          download={disabled ? undefined : true}
          aria-disabled={disabled || undefined}
          className={disabled ? `${linkClass} cursor-not-allowed opacity-50 hover:bg-white` : linkClass}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          {text}
        </a>
      ))}
    </div>
  );
}
