import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'mcp-login-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="login-panel">
      <div class="login-hero">
        <div class="brand">
          <span class="brand-mark">M</span>
          <span>MNSCloud</span>
        </div>

        <div>
          <h1>Customer Portal</h1>
          <p>Manage your services, invoices and support requests in one secure place.</p>
        </div>

        <ul>
          <li><mat-icon>receipt_long</mat-icon> Invoices, Pix and boletos</li>
          <li><mat-icon>dns</mat-icon> Your contracted services</li>
          <li><mat-icon>support_agent</mat-icon> Support requests</li>
        </ul>
      </div>

      <div class="login-form">
        <h2>Sign in</h2>
        <p class="login-subtitle">Use the username and password sent by your service provider.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <mat-icon matPrefix>person</mat-icon>
            <input matInput formControlName="login" autocomplete="username" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <mat-icon matPrefix>lock</mat-icon>
            <input
              matInput
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
            />
            <button
              matIconButton
              matSuffix
              type="button"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              (click)="showPassword.set(!showPassword())"
            >
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          @if (error()) {
            <p class="form-error" role="alert"><mat-icon>error</mat-icon>{{ error() }}</p>
          }

          <button matButton="filled" type="submit" [disabled]="form.invalid || loading()">
            <mat-icon>login</mat-icon>
            {{ loading() ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <div class="login-footer">
          <mat-icon>verified_user</mat-icon>
          Encrypted connection
        </div>
      </div>
    </section>
  `,
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { login, password } = this.form.getRawValue();
      await this.auth.signIn(login ?? '', password ?? '');
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      this.loading.set(false);
    }
  }
}
