import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

/** New password and its confirmation must match (the API checks length and the current one). */
function sameAsNew(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  return control.value === parent.get('newPassword')?.value ? null : { mismatch: true };
}

@Component({
  selector: 'mcp-profile-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'profile.eyebrow' | transloco }}</span>
          <h1>{{ 'profile.title' | transloco }}</h1>
        </div>
      </header>

      <article class="profile-panel card">
        <span class="icon-badge"><mat-icon>business</mat-icon></span>
        <div>
          <h2>
            {{ profile()?.['CustomerName'] || profile()?.['Name'] || ('app.customer' | transloco) }}
          </h2>
          <p>{{ profile()?.['CustomerEmail'] || profile()?.['Email'] }}</p>
          <p>{{ profile()?.['CustomerDocument'] }}</p>
        </div>
      </article>

      <article class="profile-panel card password-panel">
        <span class="icon-badge"><mat-icon>lock_reset</mat-icon></span>
        <div class="password-body">
          <h2>{{ 'profile.passwordTitle' | transloco }}</h2>
          @if (auth.user()?.mustChangePassword) {
            <p class="notice" role="status">{{ 'profile.passwordRequired' | transloco }}</p>
          }
          <p>{{ 'profile.passwordHint' | transloco }}</p>
          <form [formGroup]="form" (ngSubmit)="changePassword()">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.currentPassword' | transloco }}</mat-label>
              <input
                matInput
                type="password"
                formControlName="currentPassword"
                autocomplete="current-password"
              />
              <mat-error>{{ 'profile.currentPasswordRequired' | transloco }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.newPassword' | transloco }}</mat-label>
              <input
                matInput
                type="password"
                formControlName="newPassword"
                autocomplete="new-password"
              />
              <mat-error>{{ 'profile.newPasswordRule' | transloco }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.confirmPassword' | transloco }}</mat-label>
              <input
                matInput
                type="password"
                formControlName="confirmPassword"
                autocomplete="new-password"
              />
              <mat-error>{{ 'profile.passwordMismatch' | transloco }}</mat-error>
            </mat-form-field>
            @if (message(); as text) {
              <p class="notice" [class.error]="failed()" role="status">{{ text }}</p>
            }
            <button mat-flat-button type="submit" [disabled]="saving()">
              {{ (saving() ? 'profile.passwordSaving' : 'profile.passwordSubmit') | transloco }}
            </button>
          </form>
        </div>
      </article>
    </section>
  `,
  styles: `
    .password-body {
      flex: 1;
      min-width: 0;
    }
    .password-body form {
      display: grid;
      gap: 4px;
      max-width: 420px;
    }
    .notice {
      padding: 10px 12px;
      border-radius: 10px;
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    .notice.error {
      color: var(--mat-sys-error, #b3261e);
    }
  `,
})
export class ProfilePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(PortalI18nService);
  readonly auth = inject(AuthService);
  readonly profile = signal<Record<string, string | number | null> | null>(null);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly failed = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(128)]],
    confirmPassword: ['', [Validators.required, sameAsNew]],
  });

  async ngOnInit(): Promise<void> {
    this.form.controls.newPassword.valueChanges.subscribe(() =>
      this.form.controls.confirmPassword.updateValueAndValidity({ emitEvent: false }),
    );
    const response =
      await this.api.get<ApiEnvelope<{ item: Record<string, string | number | null> }>>(
        'customer-portal/auth/me',
      );
    this.profile.set(response.data.item);
  }

  async changePassword(): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.message.set(null);
    try {
      const { currentPassword, newPassword } = this.form.getRawValue();
      await this.api.post('customer-portal/auth/password', { currentPassword, newPassword });
      this.auth.markPasswordChanged();
      this.form.reset();
      this.failed.set(false);
      this.message.set(this.i18n.t('profile.passwordChanged'));
    } catch (error) {
      this.failed.set(true);
      const text = error instanceof Error ? error.message : '';
      this.message.set(
        /current password/i.test(text)
          ? this.i18n.t('profile.currentPasswordWrong')
          : this.i18n.t('profile.passwordFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
