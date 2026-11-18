/** Exact origin validation; local development permits same-host loopback only. */
export function validRequestOrigin(origin: string | null, requestUrl: string, configured: string | undefined, development: boolean) {
  if (!origin || origin === 'null') return false;
  try {
    const source = new URL(origin);
    const target = new URL(requestUrl);
    const expected = new URL(configured || target.origin);
    if (source.origin !== origin) return false;
    if (source.origin === expected.origin) return true;
    const loopback = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return development && loopback(source) && loopback(expected) &&
      source.origin === target.origin && source.port === expected.port && source.protocol === expected.protocol;
  } catch { return false; }
}
