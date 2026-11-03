import { attendanceUrl, roomBookingUrl } from '@/lib/public-url';
import { roomFileLabel } from '@/lib/room/file-name';
import { QrButton } from './qr-dialog';

// Booking QR + attendance QR side by side (both per room).
export function RoomQrButtons({ room, size = 'sm' }: { room: { id: string; name: string }; size?: 'sm' | 'md' }) {
  const stem = roomFileLabel(room);
  return (
    <>
      <QrButton
        size={size}
        label="QR Booking"
        triggerAriaLabel={`QR Booking ${room.name}`}
        title="QR Booking"
        subtitle={room.name}
        url={roomBookingUrl(room.id)}
        imageSrc={`/api/qr/room/${room.id}?format=svg`}
        fileName={`qr-booking-${stem}.png`}
      />
      <QrButton
        size={size}
        label="QR Daftar Hadir"
        triggerAriaLabel={`QR Daftar Hadir ${room.name}`}
        title="QR Daftar Hadir"
        subtitle={`${room.name} · berlaku untuk rapat yang sedang berlangsung`}
        url={attendanceUrl(room.id)}
        imageSrc={`/api/qr/hadir/${room.id}?format=svg`}
        fileName={`qr-hadir-${stem}.png`}
      />
    </>
  );
}
