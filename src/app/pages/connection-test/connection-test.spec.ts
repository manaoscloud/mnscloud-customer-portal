import { describe, expect, it } from 'vitest';
import { DNSSEC_PROBES, dnssecState, Fetcher, reach } from './connection-test';

const fetcher =
  (failing: string[]): Fetcher =>
  async (url) => {
    if (failing.some((prefix) => url.startsWith(prefix))) throw new TypeError('Failed to fetch');
    return {};
  };

describe('connection test checks', () => {
  it('measures a reachable URL and reports a failure as null', async () => {
    expect(await reach('https://www.google.com/favicon.ico', fetcher([]))).not.toBeNull();
    expect(
      await reach('https://www.google.com/favicon.ico', fetcher(['https://www.google.com'])),
    ).toBeNull();
  });

  it('tells a validating resolver from one that does not validate DNSSEC', async () => {
    expect(await dnssecState(fetcher([DNSSEC_PROBES.broken]))).toBe('validating');
    expect(await dnssecState(fetcher([]))).toBe('not_validating');
    expect(await dnssecState(fetcher([DNSSEC_PROBES.control, DNSSEC_PROBES.broken]))).toBe(
      'unknown',
    );
  });
});
