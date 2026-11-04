import { redirect } from 'next/navigation';

// Legacy path; no public meeting list anymore.
export default function LegacyPastMeetingsPage() {
  redirect('/');
}
