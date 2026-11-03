import { submitPublicAttendance } from '@/app/actions/attendance';
import type { PublicMeeting } from '@/lib/booking/public-attendance';
import { formatDateLabel, formatTimeRange, getBookingStatus } from '@/lib/booking/time';
import { AttendanceForm } from './attendance-form';
import { StatusBadge } from './status-badge';

// Public view: meeting identity + form only. Never render attendees or internal links here.
// `now` comes from the page after io() (Cache Components).
export function PublicAttendanceView({
  meeting,
  roomId,
  now,
  recaptchaSiteKey,
  deviceLockedMin,
}: {
  meeting: PublicMeeting;
  roomId: string;
  now: Date;
  recaptchaSiteKey: string | null;
  // Minutes until this device may sign again; null = not locked (or signed-in staff).
  deviceLockedMin: number | null;
}) {
  return (
    <div className="space-y-5">
      <section
        aria-labelledby="meeting-heading"
        className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Rapat · <span className="normal-case">{meeting.roomName}</span>
          </p>
          <StatusBadge
            startsAt={meeting.startsAt.toISOString()}
            endsAt={meeting.endsAt.toISOString()}
            initialStatus={getBookingStatus(meeting.startsAt, meeting.endsAt, now)}
          />
        </div>
        {/* Plain text only; line breaks kept via CSS */}
        <h1
          id="meeting-heading"
          className="mt-1 line-clamp-4 whitespace-pre-line break-words text-lg leading-snug font-semibold text-primary"
        >
          {meeting.agenda}
        </h1>
        <p className="mt-3 flex flex-wrap gap-x-2 text-sm text-zinc-700">
          <time dateTime={meeting.startsAt.toISOString()}>{formatDateLabel(meeting.startsAt)}</time>
          <span aria-hidden="true">·</span>
          <span className="font-medium tabular-nums">{formatTimeRange(meeting.startsAt, meeting.endsAt)}</span>
        </p>
      </section>

      {/* Focal point */}
      {deviceLockedMin !== null ? (
        <DeviceLockedNotice minutes={deviceLockedMin} />
      ) : (
        <section
          aria-labelledby="sign-heading"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <h2 id="sign-heading" className="mb-5 text-lg font-semibold text-primary">
            Isi Daftar Hadir
          </h2>
          <AttendanceForm
            action={submitPublicAttendance.bind(null, roomId, meeting.startsAt.toISOString())}
            variant="public"
            recaptchaSiteKey={recaptchaSiteKey}
          />
        </section>
      )}
    </div>
  );
}

// Server-computed wait; reload after the wait to get the form back.
function DeviceLockedNotice({ minutes }: { minutes: number }) {
  return (
    <section
      aria-labelledby="locked-heading"
      className="rounded-2xl border border-zinc-200 bg-white px-5 py-8 text-center shadow-sm"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-6">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <h2 id="locked-heading" className="mt-4 text-lg font-semibold text-balance text-primary">
        Perangkat ini sudah mengisi daftar hadir
      </h2>
      <p role="status" className="mt-2 text-sm text-pretty text-zinc-600">
        Coba lagi dalam <span className="font-semibold tabular-nums text-zinc-800">{formatWait(minutes)}</span>.
      </p>
      <p className="mt-4 text-xs text-pretty text-zinc-500">
        Setiap perangkat hanya dapat mengisi sekali dalam rentang waktu tertentu. Peserta lain dapat mengisi dari
        perangkat masing-masing.
      </p>
    </section>
  );
}

function formatWait(minutes: number): string {
  const m = Math.max(1, Math.ceil(minutes));
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} jam ${rest} menit` : `${h} jam`;
}

// Dead-end card: intentionally no links.
export function PublicNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="notice-heading"
      className="rounded-2xl border border-zinc-200 bg-white px-5 py-8 text-center shadow-sm"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-6">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
      <h1 id="notice-heading" className="mt-4 text-lg font-semibold text-balance break-words text-primary">
        {title}
      </h1>
      <div className="mt-2 text-sm text-pretty text-zinc-600">{children}</div>
    </section>
  );
}

// No meeting open now: show the next one in this room, if any.
export function NoMeetingNotice({ roomName, next }: { roomName: string; next: PublicMeeting | null }) {
  return (
    <PublicNotice title={`Belum ada rapat berlangsung di ${roomName}`}>
      {next ? (
        <div className="mx-auto mt-4 max-w-sm rounded-xl border border-zinc-200 border-l-4 border-l-secondary bg-zinc-50 p-4 text-left">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Rapat berikutnya</p>
          <p className="mt-1 text-sm font-medium text-zinc-800">
            <time dateTime={next.startsAt.toISOString()}>{formatDateLabel(next.startsAt)}</time>
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{formatTimeRange(next.startsAt, next.endsAt)}</span>
          </p>
          <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm text-zinc-700">{next.agenda}</p>
        </div>
      ) : (
        <p>Belum ada jadwal rapat berikutnya.</p>
      )}
      <p className="mt-4">Pindai kembali kode QR saat rapat dimulai.</p>
    </PublicNotice>
  );
}

export function PublicAttendanceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat daftar hadir" className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 motion-safe:animate-pulse">
        <div className="h-3 w-16 rounded bg-zinc-200" />
        <div className="mt-3 h-5 w-3/4 rounded bg-zinc-200" />
        <div className="mt-3 h-3 w-48 rounded bg-zinc-100" />
      </div>
      <div className="h-[28rem] rounded-2xl border border-zinc-200 bg-white motion-safe:animate-pulse" />
    </div>
  );
}
