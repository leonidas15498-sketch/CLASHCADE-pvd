/** Unknown routes fall back to the catalogue in App. Malformed escapes do too. */
export function decodeRoute(hash: string): string {
  try { return decodeURIComponent(hash.replace(/^#/, '')); }
  catch { return ''; }
}
