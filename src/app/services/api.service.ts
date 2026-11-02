import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime/runtime-config.service';

/** Refused request: the message of the API plus the HTTP status and code to tell cases apart. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

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

  async getBlob(endpoint: string): Promise<Blob> {
    return this.request<Blob>('GET', endpoint, undefined, true);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', endpoint, body);
  }

  private async request<T>(method: string, endpoint: string, body?: unknown, binary = false): Promise<T> {
    const token = localStorage.getItem('mnscloud_customer_portal_jwt');
    const response = await fetch(`${this.runtime.apiBaseUrl}/${endpoint.replace(/^\/+/, '')}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.ok && binary) return await response.blob() as T;
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      // The API revoked this session (sign-out elsewhere, customer or user disabled): drop the
      // local session and start over at the login page.
      localStorage.removeItem('mnscloud_customer_portal_jwt');
      localStorage.removeItem('mnscloud_customer_portal_user');
      this.sessionRevoked();
    }
    if (!response.ok) {
      throw new ApiError(payload?.error ?? payload?.message ?? 'Request failed.', response.status, payload?.code);
    }

    return payload as T;
  }
}
