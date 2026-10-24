import { Component, ElementRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { LanguagePickerComponent } from '../core/i18n/language-picker.component';
import { PortalI18nService } from '../core/i18n/portal-i18n.service';

@Component({
  selector: 'mcp-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
    LanguagePickerComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="login-panel">
      <div class="login-hero">
        <div class="brand">
          <span class="brand-mark">M</span>
          <span>MNSCloud</span>
        </div>

        <div>
          <h1>{{ 'app.title' | transloco }}</h1>
          <p>{{ 'login.subtitle' | transloco }}</p>
        </div>

        <ul>
          <li><mat-icon>receipt_long</mat-icon> {{ 'login.featureInvoices' | transloco }}</li>
          <li><mat-icon>dns</mat-icon> {{ 'login.featureServices' | transloco }}</li>
          <li><mat-icon>support_agent</mat-icon> {{ 'login.featureSupport' | transloco }}</li>
        </ul>
      </div>

      <div class="login-form">
        <div class="login-form-header">
          <h2>{{ 'login.title' | transloco }}</h2>
          <mcp-language-picker />
        </div>
        <p class="login-subtitle">{{ 'login.hint' | transloco }}</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'login.username' | transloco }}</mat-label>
            <mat-icon matPrefix>person</mat-icon>
            <input matInput formControlName="login" autocomplete="username" />
            <mat-error>{{ 'login.usernameRequired' | transloco }}</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'login.password' | transloco }}</mat-label>
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
              [attr.aria-label]="
                (showPassword() ? 'login.hidePassword' : 'login.showPassword') | transloco
              "
              (click)="showPassword.set(!showPassword())"
            >
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error>{{ 'login.passwordRequired' | transloco }}</mat-error>
          </mat-form-field>

          @if (error()) {
            <p class="form-error" role="alert"><mat-icon>error</mat-icon>{{ error() }}</p>
          }

          <button matButton="filled" type="submit" [disabled]="loading()">
            <mat-icon>login</mat-icon>
            {{ (loading() ? 'login.submitting' : 'login.submit') | transloco }}
          </button>
        </form>

        <div class="login-footer">
          <mat-icon>verified_user</mat-icon>
          {{ 'login.secure' | transloco }}
        </div>
        <a class="login-footer" routerLink="/teste">
          <mat-icon>network_check</mat-icon>
          {{ 'login.connectionTest' | transloco }}
        </a>
      </div>
    </section>
  `,
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(PortalI18nService);

  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.revealInvalidFields();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const { login, password } = this.form.getRawValue();
      await this.auth.signIn(login ?? '', password ?? '');
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('login.failed'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Missing fields turn red with their message and the first one receives focus. */
  private revealInvalidFields(): void {
    this.form.markAllAsTouched();
    const first = (['login', 'password'] as const).find((key) => this.form.controls[key].invalid);
    this.host.nativeElement.querySelector<HTMLElement>(`[formControlName="${first}"]`)?.focus();
  }
}
