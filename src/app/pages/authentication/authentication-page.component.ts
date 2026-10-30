import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import { type AccessDraft, accessPayload, formatOctets } from './authentication-portal';

export type AuthenticationAccount = {
  AacUUID: string;
  AacName: string;
  ClusterName: string | null;
  AccessCount: number;
  NasCount: number;
  OpenSessionCount: number;
  CanWriteAccesses: number;
  CanManageCredentials: number;
};

export type AuthenticationAccess = {
  AaxUUID: string;
  AaxUsername: string;
  AaxLoginName: string;
  AaxSubscriberLabel: string | null;
  AuthenticationProfileAapUUID: string | null;
  AuthenticationGroupAagUUID: string | null;
  EffectiveProfileName: string | null;
  GroupName: string | null;
  AaxExpiresAt: string | null;
  AaxFramedIp: string | null;
  AaxStatus: number;
  AaxRevision: number;
  AaxHasRevealableCredential: number;
};

export type AuthenticationSession = {
  AseUUID: string;
  AseUsername: string;
  NasName: string | null;
  AseSessionSeconds: string;
  AseInputOctets: string;
  AseOutputOctets: string;
  AseLastSeenAt: string | null;
  AseState: 'open' | 'stale' | 'closed';
};

type Named = { name: string; detail?: string | null; active: boolean };
export type AuthenticationCatalog = {
  profiles: { AapUUID: string; AapName: string; RateLimit: string | null; AapStatus: number }[];
  groups: { AagUUID: string; AagName: string; ProfileName: string | null; AagStatus: number }[];
  domains: { AadUUID: string; AadName: string; AadStatus: number }[];
  devices: { AanUUID: string; AanName: string; AanStatus: number }[];
  rateLimits: { ArlUUID: string; ArlName: string; ArlRateLimit: string; ArlStatus: number }[];
};

type Page<T> = { items: T[]; total: number; limit: number; offset: number };
type Credential = { AaxUUID: string; AaxLoginName: string; password: string };
type Tab = 'accesses' | 'sessions' | 'configuration';

@Component({
  selector: 'mcp-authentication-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'authentication.title' | transloco }}</h1>
          <p>{{ 'authentication.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ error()! | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'authentication.loading' | transloco }}</p>
      } @else if (accounts().length === 0 && !error()) {
        <p class="card">{{ 'authentication.empty' | transloco }}</p>
      }

      @if (accounts().length > 0) {
        <div class="accounts">
          @for (acc of accounts(); track acc.AacUUID) {
            <button
              type="button"
              class="card account"
              [class.selected]="selected()?.AacUUID === acc.AacUUID"
              (click)="select(acc)"
            >
              <span class="icon-badge"><mat-icon>router</mat-icon></span>
              <span class="account-details">
                <strong>{{ acc.AacName }}</strong>
                <small>
                  {{ acc.AccessCount }} {{ 'authentication.accesses' | transloco }} ·
                  {{ acc.OpenSessionCount }} {{ 'authentication.openSessions' | transloco }}
                </small>
              </span>
            </button>
          }
        </div>
      }

      @if (selected(); as account) {
        <nav class="tabs" role="tablist">
          @for (item of tabs; track item) {
            <button
              mat-button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === item"
              [class.active]="tab() === item"
              (click)="openTab(item)"
            >
              {{ 'authentication.tab.' + item | transloco }}
            </button>
          }
        </nav>

        @if (tab() === 'accesses') {
          <div class="toolbar">
            <mat-form-field appearance="outline" class="search">
              <mat-label>{{ 'authentication.search' | transloco }}</mat-label>
              <input matInput [(ngModel)]="search" (keyup.enter)="loadAccesses()" />
            </mat-form-field>
            @if (account.CanWriteAccesses) {
              <button mat-flat-button type="button" (click)="startCreate()">
                <mat-icon>add</mat-icon>{{ 'authentication.newAccess' | transloco }}
              </button>
            }
          </div>

          @if (credential(); as shown) {
            <div class="card credential" role="status">
              <strong>{{ 'authentication.credentialTitle' | transloco }}</strong>
              <span>{{ 'authentication.login' | transloco }}: <code>{{ shown.AaxLoginName }}</code></span>
              <span>{{ 'authentication.password' | transloco }}: <code>{{ shown.password }}</code></span>
              <button mat-button type="button" (click)="copy(shown.password)">
                <mat-icon>content_copy</mat-icon>{{ 'authentication.copy' | transloco }}
              </button>
              <button mat-button type="button" (click)="credential.set(null)">
                {{ 'authentication.close' | transloco }}
              </button>
            </div>
          }

          @if (draft(); as form) {
            <form class="card form" (ngSubmit)="save()">
              <h3>
                {{ (form.AaxUUID ? 'authentication.editAccess' : 'authentication.newAccess') | transloco }}
              </h3>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'authentication.subscriber' | transloco }}</mat-label>
                <input matInput name="subscriberLabel" maxlength="120" [(ngModel)]="form.subscriberLabel" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'authentication.group' | transloco }}</mat-label>
                <mat-select name="group" [(ngModel)]="form.AuthenticationGroupAagUUID">
                  <mat-option [value]="null">—</mat-option>
                  @for (group of activeGroups(); track group.AagUUID) {
                    <mat-option [value]="group.AagUUID">{{ group.AagName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'authentication.profile' | transloco }}</mat-label>
                <mat-select name="profile" [(ngModel)]="form.AuthenticationProfileAapUUID">
                  <mat-option [value]="null">—</mat-option>
                  @for (profile of activeProfiles(); track profile.AapUUID) {
                    <mat-option [value]="profile.AapUUID">{{ profile.AapName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              @if (!form.AaxUUID && activeDomains().length) {
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'authentication.domain' | transloco }}</mat-label>
                  <mat-select name="domain" [(ngModel)]="form.AuthenticationDomainAadUUID">
                    <mat-option [value]="null">—</mat-option>
                    @for (domain of activeDomains(); track domain.AadUUID) {
                      <mat-option [value]="domain.AadUUID">{{ domain.AadName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }
              <mat-form-field appearance="outline">
                <mat-label>{{ 'authentication.framedIp' | transloco }}</mat-label>
                <input matInput name="framedIp" [(ngModel)]="form.framedIp" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'authentication.expiresAt' | transloco }}</mat-label>
                <input matInput type="datetime-local" name="expiresAt" [(ngModel)]="form.expiresAt" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'authentication.status' | transloco }}</mat-label>
                <mat-select name="status" [(ngModel)]="form.status">
                  <mat-option [value]="1">{{ 'authentication.active' | transloco }}</mat-option>
                  <mat-option [value]="0">{{ 'authentication.inactive' | transloco }}</mat-option>
                </mat-select>
              </mat-form-field>
              <div class="form-actions">
                <button mat-button type="button" (click)="draft.set(null)">
                  {{ 'authentication.cancel' | transloco }}
                </button>
                <button mat-flat-button type="submit" [disabled]="saving()">
                  {{ 'authentication.save' | transloco }}
                </button>
              </div>
            </form>
          }

          @if (accesses().length === 0) {
            <p class="card">{{ 'authentication.emptyAccesses' | transloco }}</p>
          } @else {
            <div class="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>{{ 'authentication.login' | transloco }}</th>
                    <th>{{ 'authentication.subscriber' | transloco }}</th>
                    <th>{{ 'authentication.profile' | transloco }}</th>
                    <th>{{ 'authentication.status' | transloco }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of accesses(); track row.AaxUUID) {
                    <tr>
                      <td><code>{{ row.AaxLoginName }}</code></td>
                      <td>{{ row.AaxSubscriberLabel ?? '—' }}</td>
                      <td>{{ row.EffectiveProfileName ?? '—' }}</td>
                      <td>{{ (row.AaxStatus ? 'authentication.active' : 'authentication.inactive') | transloco }}</td>
                      <td class="row-actions">
                        @if (account.CanManageCredentials && row.AaxHasRevealableCredential) {
                          <button mat-icon-button type="button" (click)="reveal(row)" [attr.aria-label]="'authentication.showPassword' | transloco">
                            <mat-icon>visibility</mat-icon>
                          </button>
                        }
                        @if (account.CanManageCredentials) {
                          <button mat-icon-button type="button" (click)="rotate(row)" [attr.aria-label]="'authentication.newPassword' | transloco">
                            <mat-icon>lock_reset</mat-icon>
                          </button>
                        }
                        @if (account.CanWriteAccesses) {
                          <button mat-icon-button type="button" (click)="startEdit(row)" [attr.aria-label]="'authentication.editAccess' | transloco">
                            <mat-icon>edit</mat-icon>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        @if (tab() === 'sessions') {
          <p class="hint">{{ 'authentication.sessionsHint' | transloco }}</p>
          @if (sessions().length === 0) {
            <p class="card">{{ 'authentication.emptySessions' | transloco }}</p>
          } @else {
            <div class="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>{{ 'authentication.login' | transloco }}</th>
                    <th>{{ 'authentication.device' | transloco }}</th>
                    <th>{{ 'authentication.state' | transloco }}</th>
                    <th>{{ 'authentication.traffic' | transloco }}</th>
                    <th>{{ 'authentication.lastSeen' | transloco }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of sessions(); track row.AseUUID) {
                    <tr>
                      <td><code>{{ row.AseUsername }}</code></td>
                      <td>{{ row.NasName ?? '—' }}</td>
                      <td>{{ 'authentication.sessionState.' + row.AseState | transloco }}</td>
                      <td>{{ octets(row.AseInputOctets) }} / {{ octets(row.AseOutputOctets) }}</td>
                      <td>{{ row.AseLastSeenAt ? (row.AseLastSeenAt | date: 'short') : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }

        @if (tab() === 'configuration') {
          <div class="config-grid">
            @for (section of configSections(); track section.key) {
              <article class="card">
                <h3>{{ 'authentication.config.' + section.key | transloco }}</h3>
                @if (section.items.length === 0) {
                  <p class="hint">—</p>
                }
                <ul>
                  @for (item of section.items; track $index) {
                    <li [class.inactive]="!item.active">
                      {{ item.name }}
                      @if (item.detail) {
                        <small>{{ item.detail }}</small>
                      }
                    </li>
                  }
                </ul>
              </article>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .accounts { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); margin-bottom: 16px; }
    .account { display: flex; gap: 12px; align-items: center; padding: 16px; text-align: start; cursor: pointer; border: 2px solid transparent; font: inherit; color: inherit; }
    .account.selected { border-color: var(--primary, #1976d2); }
    .account-details { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
    .account-details small, .hint { color: var(--text-secondary, #666); }
    .tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
    .tabs .active { font-weight: 600; text-decoration: underline; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .search { flex: 1 1 240px; }
    .credential { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 12px 16px; margin-bottom: 12px; }
    .form { display: grid; gap: 4px 16px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); padding: 16px; margin-bottom: 12px; }
    .form h3, .form-actions { grid-column: 1 / -1; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .table-wrap { overflow-x: auto; padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: start; border-bottom: 1px solid var(--border-color, #eee); white-space: nowrap; }
    .row-actions { text-align: end; }
    .config-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
    .config-grid article { padding: 16px; }
    .config-grid ul { margin: 0; padding-inline-start: 18px; }
    .config-grid small { display: block; color: var(--text-secondary, #666); }
    .inactive { opacity: 0.6; }
  `],
})
export class AuthenticationPageComponent {
  private readonly api = inject(ApiService);
  private readonly transloco = inject(TranslocoService);
  readonly tabs: Tab[] = ['accesses', 'sessions', 'configuration'];
  readonly accounts = signal<AuthenticationAccount[]>([]);
  readonly selected = signal<AuthenticationAccount | null>(null);
  readonly tab = signal<Tab>('accesses');
  readonly accesses = signal<AuthenticationAccess[]>([]);
  readonly sessions = signal<AuthenticationSession[]>([]);
  readonly catalog = signal<AuthenticationCatalog | null>(null);
  readonly draft = signal<AccessDraft | null>(null);
  readonly credential = signal<Credential | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  search = '';

  readonly activeProfiles = computed(() => (this.catalog()?.profiles ?? []).filter((x) => x.AapStatus));
  readonly activeGroups = computed(() => (this.catalog()?.groups ?? []).filter((x) => x.AagStatus));
  readonly activeDomains = computed(() => (this.catalog()?.domains ?? []).filter((x) => x.AadStatus));
  readonly configSections = computed(() => {
    const c = this.catalog();
    const list = (items: Named[]) => items;
    return [
      { key: 'profiles', items: list((c?.profiles ?? []).map((x) => ({ name: x.AapName, detail: x.RateLimit, active: !!x.AapStatus }))) },
      { key: 'groups', items: list((c?.groups ?? []).map((x) => ({ name: x.AagName, detail: x.ProfileName, active: !!x.AagStatus }))) },
      { key: 'rateLimits', items: list((c?.rateLimits ?? []).map((x) => ({ name: x.ArlName, detail: x.ArlRateLimit, active: !!x.ArlStatus }))) },
      { key: 'domains', items: list((c?.domains ?? []).map((x) => ({ name: x.AadName, active: !!x.AadStatus }))) },
      { key: 'devices', items: list((c?.devices ?? []).map((x) => ({ name: x.AanName, active: !!x.AanStatus }))) },
    ];
  });

  constructor() {
    void this.load();
  }

  octets(value: string): string {
    return formatOctets(value);
  }

  private base(): string {
    return `customer-portal/authentication/accounts/${this.selected()!.AacUUID}`;
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: AuthenticationAccount[] }>>(
        'customer-portal/authentication/accounts',
      );
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length) await this.select(items[0]);
    } catch {
      this.error.set('authentication.error');
    } finally {
      this.loading.set(false);
    }
  }

  async select(account: AuthenticationAccount) {
    this.selected.set(account);
    this.draft.set(null);
    this.credential.set(null);
    this.catalog.set(null);
    await this.openTab('accesses');
  }

  async openTab(tab: Tab) {
    this.tab.set(tab);
    this.error.set(null);
    try {
      if (tab === 'accesses') {
        await Promise.all([this.loadAccesses(), this.loadCatalog()]);
      } else if (tab === 'sessions') {
        const response = await this.api.get<ApiEnvelope<Page<AuthenticationSession>>>(
          `${this.base()}/sessions?limit=100`,
        );
        this.sessions.set(response.data?.items ?? []);
      } else {
        await this.loadCatalog();
      }
    } catch {
      this.error.set('authentication.error');
    }
  }

  private async loadCatalog() {
    if (this.catalog()) return;
    const response = await this.api.get<ApiEnvelope<AuthenticationCatalog>>(`${this.base()}/catalog`);
    this.catalog.set(response.data ?? null);
  }

  async loadAccesses() {
    const query = new URLSearchParams({ limit: '100' });
    if (this.search.trim()) query.set('search', this.search.trim());
    const response = await this.api.get<ApiEnvelope<Page<AuthenticationAccess>>>(
      `${this.base()}/accesses?${query}`,
    );
    this.accesses.set(response.data?.items ?? []);
  }

  startCreate() {
    this.credential.set(null);
    this.draft.set({
      AuthenticationProfileAapUUID: null,
      AuthenticationGroupAagUUID: null,
      AuthenticationDomainAadUUID: null,
      subscriberLabel: '',
      framedIp: '',
      expiresAt: '',
      status: 1,
    });
  }

  startEdit(row: AuthenticationAccess) {
    this.credential.set(null);
    const expires = row.AaxExpiresAt ? new Date(row.AaxExpiresAt) : null;
    const local = expires
      ? new Date(expires.getTime() - expires.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : '';
    this.draft.set({
      AaxUUID: row.AaxUUID,
      revision: row.AaxRevision,
      AuthenticationProfileAapUUID: row.AuthenticationProfileAapUUID,
      AuthenticationGroupAagUUID: row.AuthenticationGroupAagUUID,
      AuthenticationDomainAadUUID: null,
      subscriberLabel: row.AaxSubscriberLabel ?? '',
      framedIp: row.AaxFramedIp ?? '',
      expiresAt: local,
      status: row.AaxStatus,
    });
  }

  async save() {
    const draft = this.draft();
    if (!draft) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      if (draft.AaxUUID) {
        await this.api.put(`${this.base()}/accesses/${draft.AaxUUID}`, accessPayload(draft, false));
      } else {
        const response = await this.api.post<ApiEnvelope<Credential>>(
          `${this.base()}/accesses`,
          accessPayload(draft, true),
        );
        this.credential.set(response.data ?? null);
      }
      this.draft.set(null);
      await this.loadAccesses();
    } catch {
      this.error.set('authentication.saveError');
    } finally {
      this.saving.set(false);
    }
  }

  async reveal(row: AuthenticationAccess) {
    try {
      const response = await this.api.post<ApiEnvelope<Credential>>(
        `${this.base()}/accesses/${row.AaxUUID}/credential/reveal`,
        {},
      );
      this.credential.set(response.data ?? null);
    } catch {
      this.error.set('authentication.error');
    }
  }

  async rotate(row: AuthenticationAccess) {
    // The equipment of the subscriber stops logging in until it gets the new password.
    if (!window.confirm(this.transloco.translate('authentication.newPasswordConfirm'))) return;
    try {
      const response = await this.api.post<ApiEnvelope<Credential>>(
        `${this.base()}/accesses/${row.AaxUUID}/credential/rotate`,
        { revision: row.AaxRevision },
      );
      this.credential.set(response.data ?? null);
      await this.loadAccesses();
    } catch {
      this.error.set('authentication.saveError');
    }
  }

  async copy(value: string) {
    await navigator.clipboard?.writeText(value);
  }
}
