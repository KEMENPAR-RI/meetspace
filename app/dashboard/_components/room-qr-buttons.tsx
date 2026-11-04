import { roomBookingUrl } from '@/lib/public-url';
import { roomFileLabel } from '@/lib/room/file-name';
import { QrButton } from './qr-dialog';

// Per-room booking QR.
export function RoomQrButtons({ room, size = 'sm' }: { room: { id: string; name: string }; size?: 'sm' | 'md' }) {
  const stem = roomFileLabel(room);
  return (
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
  );
}
