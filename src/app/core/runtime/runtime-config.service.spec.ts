import { TestBed } from '@angular/core/testing';
import { RuntimeConfigService } from './runtime-config.service';

function apiBaseUrl(configured: string | undefined): string {
  window.MNSCLOUD_CUSTOMER_PORTAL_CONFIG = { apiBaseUrl: configured };
  TestBed.resetTestingModule();
  return TestBed.inject(RuntimeConfigService).apiBaseUrl;
}

describe('RuntimeConfigService', () => {
  afterEach(() => delete window.MNSCLOUD_CUSTOMER_PORTAL_CONFIG);

  it('defaults to the same-origin API', () => {
    expect(apiBaseUrl(undefined)).toBe(`${window.location.origin}/api/v1`);
    expect(apiBaseUrl('  ')).toBe(`${window.location.origin}/api/v1`);
  });

  it('normalizes configured hosts to the versioned API path', () => {
    expect(apiBaseUrl('https://api.example.com')).toBe('https://api.example.com/api/v1');
    expect(apiBaseUrl('https://api.example.com/api/')).toBe('https://api.example.com/api/v1');
    expect(apiBaseUrl('https://api.example.com/api/v1//')).toBe('https://api.example.com/api/v1');
  });
});
