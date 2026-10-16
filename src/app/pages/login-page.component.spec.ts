import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent required fields', () => {
  let signIn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    signIn = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { signIn } }],
    });
  });

  it('keeps Sign in enabled and reveals the missing fields instead of submitting', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(signIn).not.toHaveBeenCalled();
    expect(element.querySelectorAll('.mat-form-field-invalid').length).toBe(2);
    expect(element.textContent).toContain('Enter your username.');
    expect(document.activeElement?.getAttribute('formControlName')).toBe('login');
    fixture.nativeElement.remove();
  });

  it('focuses the password when only the password is missing', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.login.setValue('customer');

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(signIn).not.toHaveBeenCalled();
    expect(document.activeElement?.getAttribute('formControlName')).toBe('password');
    fixture.nativeElement.remove();
  });
});
