/**
 * The LAN JSON store is intended to run on the local Master PC.
 * Do not call it from a public cloud hostname such as Vercel.
 */
export function isLocalMasterHost(): boolean {
  if (typeof window === 'undefined') return false;

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
  if (!ipv4) return false;

  const first = Number(ipv4[1]);
  const second = Number(ipv4[2]);

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
