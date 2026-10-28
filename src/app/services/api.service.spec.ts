import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';

const JWT_KEY = 'mnscloud_customer_portal_jwt';
const USER_KEY = 'mnscloud_customer_portal_user';

function respond(status: number, body: unknown) {
  globalThis.fetch = (() =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))) as typeof fetch;
}

describe('ApiService', () => {
  const originalFetch = globalThis.fetch;
  let api: ApiService;
  let revoked: number;

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = TestBed.inject(ApiService);
    revoked = 0;
    api.sessionRevoked = () => revoked++;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it('drops a session the API revoked and returns to the login page', async () => {
    localStorage.setItem(JWT_KEY, 'token');
    localStorage.setItem(USER_KEY, '{}');
    respond(401, { error: 'Customer portal session is no longer valid.' });
    await expect(api.get('customer-portal/auth/me')).rejects.toThrow();
    expect(localStorage.getItem(JWT_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(revoked).toBe(1);
  });

  it('keeps the login form in place when anonymous credentials are rejected', async () => {
    respond(401, { error: 'Invalid credentials.' });
    await expect(api.post('customer-portal/auth/signin', {})).rejects.toThrow();
    expect(revoked).toBe(0);
  });
  it('downloads private bytes with the session header and handles revoked binary requests', async () => {
    localStorage.setItem(JWT_KEY, 'synthetic-test-token');
    let authorization: unknown;
    globalThis.fetch = (async (_url, init) => {
      authorization = (init?.headers as Record<string,string>)?.['Authorization'];
      return new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'application/pdf' } });
    }) as typeof fetch;
    const blob = await api.getBlob('customer-portal/ged/documents/document/versions/version/content');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBe(3);
    expect(authorization).toBe('Bearer synthetic-test-token');
    respond(401, { error: 'Revoked' });
    await expect(api.getBlob('customer-portal/ged/documents/document/versions/version/content')).rejects.toThrow();
    expect(localStorage.getItem(JWT_KEY)).toBeNull();
    expect(revoked).toBe(1);
  });

});
