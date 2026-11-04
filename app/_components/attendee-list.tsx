import { UserRoundX, Users } from 'lucide-react';
import { signatureFont } from '@/app/fonts/signature';
import { attendeeRoleLabel, genderLabel, type Attendee } from '@/lib/booking/types';
import { DeleteAttendeeButton } from './delete-attendee-button';

// Server component; rows arrive sorted by signedAt (query order).
// showPhone/canDelete are dashboard-only; public pages never pass them (H5).
export function AttendeeList({
  attendees,
  showPhone = false,
  canDelete = false,
}: {
  attendees: Attendee[];
  showPhone?: boolean;
  canDelete?: boolean;
}) {
  return (
    <section aria-labelledby="attendees-heading">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="attendees-heading" className="flex items-center gap-2 text-lg font-semibold text-primary">
          <Users className="size-5" />
          Peserta
        </h2>
        <p className="rounded-full bg-secondary/40 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
          {attendees.length} hadir
        </p>
      </div>

      {attendees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          <UserRoundX className="mx-auto mb-2 block size-6 text-zinc-400" />
          Belum ada peserta yang mengisi daftar hadir.
        </p>
      ) : (
        <ol className="space-y-3">
          {attendees.map((a, i) => (
            <li key={a.id} className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-4">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/5 text-xs font-semibold tabular-nums text-primary"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-zinc-800">{a.name}</p>
                    <p className="mt-0.5 break-words text-sm text-zinc-600">
                      <span className="sr-only">Satker/Instansi: </span>
                      {a.satker}
                      <span aria-hidden="true"> · </span>
                      <span className="sr-only">Sebagai: </span>
                      {attendeeRoleLabel(a.role)}
                      <span aria-hidden="true"> · </span>
                      <span className="sr-only">Jenis kelamin: </span>
                      {genderLabel(a.gender)}
                    </p>
                    {/* Defense in depth: public pages also null the phone */}
                    {showPhone && a.phone && (
                      <p className="mt-0.5 text-sm tabular-nums text-zinc-500">
                        <span className="sr-only">No HP: </span>
                        {displayPhone(a.phone)}
                      </p>
                    )}
                  </div>
                  {/* UX only; the action re-checks access */}
                  {canDelete && <DeleteAttendeeButton id={a.id} label={`Hapus ${a.name} dari daftar hadir`} />}
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                  {/* Name rendered as signature on a signature line */}
                  <p className="min-w-0 max-w-full border-b border-zinc-300 pr-6 pb-0.5">
                    <span className="sr-only">Tanda tangan: </span>
                    <span className={`${signatureFont.className} break-words text-3xl leading-tight text-primary`}>{a.name}</span>
                  </p>
                  <p className="text-xs tabular-nums text-zinc-500">
                    <time dateTime={a.signedAtISO}>{a.signedAtLabel}</time>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Stored as 628xxxxxxxxx; shown in local 08xx form.
function displayPhone(phone: string): string {
  return phone.startsWith('62') ? `0${phone.slice(2)}` : phone;
}
