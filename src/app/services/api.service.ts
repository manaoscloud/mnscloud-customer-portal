import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly runtime = inject(RuntimeConfigService);

  /** Full reload to the login page so every in-memory session state is reset. */
  sessionRevoked = (): void => {
    window.location.assign(new URL('auth/login', document.baseURI).toString());
  };

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
    const token = localStorage.getItem('mnscloud_customer_portal_jwt');
    const response = await fetch(`${this.runtime.apiBaseUrl}/${endpoint.replace(/^\/+/, '')}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      // The API revoked this session (sign-out elsewhere, customer or user disabled): drop the
      // local session and start over at the login page.
      localStorage.removeItem('mnscloud_customer_portal_jwt');
      localStorage.removeItem('mnscloud_customer_portal_user');
      this.sessionRevoked();
    }
    if (!response.ok) {
      throw new Error(payload?.error ?? payload?.message ?? 'Request failed.');
    }

    return payload as T;
  }
}
