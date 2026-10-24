/**
 * Browser checks of the public connection test (DNS module D4d). Each check only loads public HTTPS
 * resources; nothing reads their content (no-cors), so only reachability and time are measured.
 */

export type CheckState = 'pending' | 'ok' | 'failed';

export type ServiceCheck = { key: string; url: string; state: CheckState; ms: number | null };

/** Fixed list shared with the API (CLIENT_TEST_SERVICES). */
export const SERVICES: ReadonlyArray<{ key: string; url: string }> = [
  { key: 'google', url: 'https://www.google.com/favicon.ico' },
  { key: 'youtube', url: 'https://www.youtube.com/favicon.ico' },
  { key: 'whatsapp', url: 'https://web.whatsapp.com/favicon.ico' },
  { key: 'instagram', url: 'https://www.instagram.com/favicon.ico' },
  { key: 'facebook', url: 'https://www.facebook.com/favicon.ico' },
  { key: 'netflix', url: 'https://www.netflix.com/favicon.ico' },
  { key: 'microsoft', url: 'https://www.microsoft.com/favicon.ico' },
  { key: 'govbr', url: 'https://www.gov.br/favicon.ico' },
  { key: 'globo', url: 'https://www.globo.com/favicon.ico' },
];

/** Hosts published only over IPv4 / only over IPv6. */
export const FAMILY_PROBES = {
  ipv4: 'https://ipv4.google.com/favicon.ico',
  ipv6: 'https://ipv6.google.com/favicon.ico',
} as const;

/** DNSSEC: a correctly signed site (control) and one signed wrongly on purpose by CZ.NIC. */
export const DNSSEC_PROBES = {
  control: 'https://www.nic.cz/favicon.ico',
  broken: 'https://www.rhybar.cz/',
} as const;

const TIMEOUT_MS = 8000;

export type Fetcher = (url: string, signal: AbortSignal) => Promise<unknown>;

export const browserFetch: Fetcher = (url, signal) =>
  fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
    mode: 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });

/** Time to reach one URL, or null when it failed or timed out. */
export async function reach(url: string, fetcher: Fetcher = browserFetch): Promise<number | null> {
  const started = performance.now();
  try {
    await fetcher(url, AbortSignal.timeout(TIMEOUT_MS));
    return Math.round(performance.now() - started);
  } catch {
    return null;
  }
}

/** validating when the broken site fails while the signed one loads; unknown without the control. */
export async function dnssecState(
  fetcher: Fetcher = browserFetch,
): Promise<'validating' | 'not_validating' | 'unknown'> {
  const [control, broken] = await Promise.all([
    reach(DNSSEC_PROBES.control, fetcher),
    reach(DNSSEC_PROBES.broken, fetcher),
  ]);
  if (control === null) return 'unknown';
  return broken === null ? 'validating' : 'not_validating';
}
