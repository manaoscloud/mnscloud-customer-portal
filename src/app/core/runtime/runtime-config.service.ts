import { Injectable } from '@angular/core';

type RuntimeConfig = {
  apiBaseUrl?: string;
};

declare global {
  interface Window {
    MNSCLOUD_CUSTOMER_PORTAL_CONFIG?: RuntimeConfig;
  }
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return `${window.location.origin}/api/v1`;

  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  if (withoutTrailingSlash.endsWith('/api/v1')) return withoutTrailingSlash;
  if (withoutTrailingSlash.endsWith('/api')) return `${withoutTrailingSlash}/v1`;
  return `${withoutTrailingSlash}/api/v1`;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  readonly apiBaseUrl = normalizeApiBaseUrl(window.MNSCLOUD_CUSTOMER_PORTAL_CONFIG?.apiBaseUrl);
}
