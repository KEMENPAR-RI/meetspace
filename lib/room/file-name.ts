// ASCII-safe room label for download filenames: sanitized name + first 8 id chars, e.g. "ruang-rapat-00000000".
export function roomFileLabel(room: { id: string; name: string }): string {
  const name = room.name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  const shortId = room.id.slice(0, 8).toLowerCase();
  return name ? `${name}-${shortId}` : `ruang-${shortId}`;
}
