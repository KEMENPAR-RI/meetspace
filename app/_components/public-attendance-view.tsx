import { CalendarDays, Clock, DoorOpen, Info, PenLine } from 'lucide-react';
import { submitPublicAttendance } from '@/app/actions/attendance';
import type { PublicMeeting } from '@/lib/booking/public-attendance';
import { formatWait } from '@/lib/booking/types';
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
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            <DoorOpen className="size-4 shrink-0" />
            <span className="truncate">Rapat · <span className="normal-case">{meeting.roomName}</span></span>
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
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-zinc-700">
          <CalendarDays className="size-4 shrink-0 text-zinc-400" />
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
          <h2 id="sign-heading" className="mb-5 flex items-center gap-2 text-lg font-semibold text-primary">
            <PenLine className="size-5" />
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
        <Clock className="size-6" />
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

// Dead-end card: intentionally no links.
export function PublicNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="notice-heading"
      className="rounded-2xl border border-zinc-200 bg-white px-5 py-8 text-center shadow-sm"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary/30 text-primary">
        <Info className="size-6" />
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
