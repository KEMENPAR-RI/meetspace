import { FileSpreadsheet, FileText } from 'lucide-react';

type Props = { searchParams: string; disabled?: boolean };

const linkClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 text-sm font-medium text-primary ' +
  'hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors';

const FORMATS = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
] as const;

// Plain anchors: the route streams an attachment, no client navigation.
export function ExportButtons({ searchParams, disabled = false }: Props) {
  const suffix = searchParams ? `&${searchParams}` : '';
  const hint = 'Persempit filter untuk mengekspor';

  return (
    <div
      role="group"
      aria-label={disabled ? `Ekspor tidak tersedia. ${hint}` : 'Ekspor log sesuai filter aktif'}
      title={disabled ? hint : undefined}
      className="flex items-center gap-2"
    >
      <span className="hidden text-xs text-zinc-500 sm:inline">{disabled ? hint : 'Ekspor'}</span>
      {FORMATS.map(({ format, label }) => (
        // No href when disabled: the route would answer 413 and `download` would save the JSON.
        <a
          key={format}
          href={disabled ? undefined : `/api/log/export?format=${format}${suffix}`}
          download={disabled ? undefined : true}
          aria-disabled={disabled || undefined}
          className={disabled ? `${linkClass} cursor-not-allowed opacity-50 hover:bg-white` : linkClass}
        >
          {format === 'xlsx' ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
          {label}
        </a>
      ))}
    </div>
  );
}
