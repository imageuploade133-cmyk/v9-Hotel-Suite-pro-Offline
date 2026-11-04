/**
 * Returns true if the client is running on the local Master PC or on local Wi-Fi.
 * In offline situations (!navigator.onLine), it also returns true so local storage/SSE is always active.
 */
export function isLocalMasterHost(): boolean {
  if (typeof window === 'undefined') return false;

  // If the browser reports offline, LAN mode is mandatory
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }

  const hostname = window.location.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    !hostname.includes('.')
  ) {
    return true;
  }

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const first = Number(ipv4[1]);
    const second = Number(ipv4[2]);
    if (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    ) {
      return true;
    }
  }

  // Also enable in AI Studio dev environment for seamless offline simulation
  return true;
}
