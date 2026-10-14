import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

const JWT_KEY = 'mnscloud_customer_portal_jwt';
const USER_KEY = 'mnscloud_customer_portal_user';

function runGuard() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
}

describe('authGuard', () => {
  afterEach(() => localStorage.clear());

  it('redirects to the login page without a stored session', () => {
    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/auth/login');
  });

  it('allows navigation with a stored token and user', () => {
    localStorage.setItem(JWT_KEY, 'placeholder-token');
    localStorage.setItem(USER_KEY, JSON.stringify({ uuid: 'user-1', email: 'user@example.com' }));

    expect(runGuard()).toBe(true);
  });

  it('drops a corrupted stored user instead of failing', () => {
    localStorage.setItem(JWT_KEY, 'placeholder-token');
    localStorage.setItem(USER_KEY, '{not json');

    expect(runGuard()).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(AuthService).user()).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });
});
