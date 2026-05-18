import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime/runtime-config.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly runtime = inject(RuntimeConfigService);

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
    if (!response.ok) {
      throw new Error(payload?.error ?? payload?.message ?? 'Request failed.');
    }

    return payload as T;
  }
}
