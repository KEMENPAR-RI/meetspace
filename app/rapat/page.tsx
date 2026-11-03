import { redirect } from 'next/navigation';

// Past meetings now live per room (/ruang/[id]/rapat).
export default function LegacyPastMeetingsPage() {
  redirect('/');
}
