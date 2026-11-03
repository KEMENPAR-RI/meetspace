import { redirect } from 'next/navigation';

// Admin log moved to the dashboard (I3).
export default function LegacyLogPage() {
  redirect('/dashboard/log');
}
