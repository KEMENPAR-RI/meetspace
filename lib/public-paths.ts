// Paths reachable from outside the office network (pure; used by proxy.ts).
// Per-room attendance page /hadir/<roomId>; the logo is shown on it.
const PUBLIC_ATTENDANCE_PATH = /^\/(?:hadir\/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\/?|api\/logo)$/;
// Dashboard (incl. login) and its API: protected by login + role checks, not by office IP,
// so a superadmin can always reach the settings page.
const DASHBOARD_PATH = /^\/(?:dashboard(?:\/.*)?|api\/qr\/(?:room|hadir)\/[^/]+|api\/log\/export|api\/rapat\/[^/]+\/export)$/;

export function isPublicAttendancePath(pathname: string): boolean {
  return PUBLIC_ATTENDANCE_PATH.test(pathname);
}

export function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PATH.test(pathname);
}
