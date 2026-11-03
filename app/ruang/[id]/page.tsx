import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { io } from 'next/cache';
import { createBooking } from '@/app/actions/booking';
import { findPublicRoomById } from '@/lib/room/queries';
import { getRecaptchaSiteKey } from '@/lib/settings/recaptcha';
import { BackLink } from '../../_components/back-link';
import { BookingForm } from '../../_components/booking-form';
import { BookingList, BookingListSkeleton } from '../../_components/booking-list';
import { RoomMeta } from '../../_components/room-meta';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

export const metadata: Metadata = { title: 'Booking Ruangan' };

type Params = Promise<{ id: string }>;

export default function RoomPage({ params }: { params: Params }) {
  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 font-sans sm:px-6 lg:py-14">
        <SiteHeader />
        <div className="mb-4">
          <BackLink href="/">Semua ruangan</BackLink>
        </div>
        <Suspense fallback={<RoomSkeleton />}>
          <RoomContent params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function RoomContent({ params }: { params: Params }) {
  const { id } = await params;

  await io();
  // Invalid or unknown id → 404 (C7).
  const [room, recaptchaSiteKey] = await Promise.all([findPublicRoomById(id), getRecaptchaSiteKey()]);
  if (!room) notFound();

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="room-heading"
        className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 shadow-sm sm:p-6"
      >
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Ruangan</p>
        <h2 id="room-heading" className="mt-1 text-2xl font-semibold tracking-tight break-words text-primary">
          {room.name}
        </h2>
        <RoomMeta room={room} className="mt-1.5" />
        {room.facilities && (
          <p className="mt-3 text-sm whitespace-pre-line break-words text-zinc-700">
            <span className="font-medium text-zinc-800">Fasilitas: </span>
            {room.facilities}
          </p>
        )}
      </section>

      {room.isActive ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
          {/* Focal point: the form */}
          <section
            aria-labelledby="form-heading"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-8"
          >
            <h2 id="form-heading" className="mb-5 text-lg font-semibold text-primary">
              Buat Booking
            </h2>
            <BookingForm action={createBooking.bind(null, room.id)} recaptchaSiteKey={recaptchaSiteKey} />
          </section>

          <section aria-labelledby="list-heading">
            <h2 id="list-heading" className="mb-4 text-lg font-semibold text-primary">
              Booking Mendatang
            </h2>
            <Suspense fallback={<BookingListSkeleton />}>
              <BookingList roomId={room.id} />
            </Suspense>
            <PastLink roomId={room.id} />
          </section>
        </div>
      ) : (
        <section
          aria-labelledby="unavailable-heading"
          className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8"
        >
          <h2 id="unavailable-heading" className="text-lg font-semibold text-primary">
            Ruangan tidak tersedia
          </h2>
          <p className="mt-2 text-sm text-pretty text-zinc-600">
            Ruangan ini sedang tidak dapat dibooking. Silakan pilih ruangan lain.
          </p>
          <div className="mt-5">
            <BackLink href="/">Pilih ruangan lain</BackLink>
          </div>
        </section>
      )}
    </div>
  );
}

function PastLink({ roomId }: { roomId: string }) {
  return (
    <Link
      href={`/ruang/${roomId}/rapat`}
      className="mt-4 inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Lihat rapat sebelumnya
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
        <path
          fillRule="evenodd"
          d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </Link>
  );
}

function RoomSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat ruangan" className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 border-l-4 border-l-secondary bg-white p-5 motion-safe:animate-pulse sm:p-6">
        <div className="h-3 w-20 rounded bg-zinc-200" />
        <div className="mt-3 h-7 w-56 max-w-full rounded bg-zinc-200" />
        <div className="mt-3 h-3 w-40 rounded bg-zinc-100" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="h-[30rem] rounded-2xl border border-zinc-200 bg-white motion-safe:animate-pulse" />
        <BookingListSkeleton />
      </div>
    </div>
  );
}
