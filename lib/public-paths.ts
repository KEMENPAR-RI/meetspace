// Public GET pages rate limited per IP by proxy.ts (pure).
// Home (calendar + booking list), room booking form, and the logo (also shown on the dashboard login page).
const PUBLIC_PATH = /^\/(?:|ruang\/[^/]+|api\/logo)$/;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH.test(pathname);
}
