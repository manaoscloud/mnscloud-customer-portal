import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import type { AuthResponse, CustomerPortalUser } from '../../models/session.model';

const JWT_KEY = 'mnscloud_customer_portal_jwt';
const USER_KEY = 'mnscloud_customer_portal_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly userState = signal<CustomerPortalUser | null>(this.readStoredUser());

  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => !!this.userState() && !!this.token);

  get token(): string | null {
    return localStorage.getItem(JWT_KEY);
  }

  async signIn(email: string, password: string): Promise<void> {
    const response = await this.api.post<AuthResponse>('customer-portal/auth/signin', {
      email,
      password,
    });

    localStorage.setItem(JWT_KEY, response.data.jwt);
    localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
    this.userState.set(response.data.user);
  }

  signOut(): void {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(USER_KEY);
    this.userState.set(null);
    void this.router.navigateByUrl('/auth/login');
  }

  private readStoredUser(): CustomerPortalUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as CustomerPortalUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
