import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type SecurityAccount = {
  CyaUUID: string;
  CyaName: string;
  ServersCount: number;
  VaultsCount: number;
  Dashboard: number;
  Servers: number;
  Threats: number;
  AlertAck: number;
  Unblock: number;
  Secrets: number;
  SecretReveal: number;
};
type Dashboard = Record<string, number>;
type Server = {
  uuid: string;
  name: string;
  publicIP: string | null;
  osName: string | null;
  osVersion: string | null;
  firewallStatus: string;
  crowdsecStatus: string;
  bouncerStatus: string;
  protectionStatus: string;
  mode: string;
  lastSyncAt: string | null;
};
type Alert = {
  uuid: string;
  level: string;
  status: string;
  scenario: string | null;
  sourceIP: string | null;
  message: string;
  detectedAt: string | null;
  serverName: string | null;
};
type Block = {
  uuid: string;
  value: string;
  action: string;
  scenario: string | null;
  expiresAt: string | null;
  serverName: string | null;
  requestStatus: string | null;
};
type UnblockRequest = {
  uuid: string;
  value: string;
  reason: string | null;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
  requestedBy: string;
  blockExpiresAt: string | null;
};
type Vault = { uuid: string; name: string; secretsCount: number };
type Secret = {
  uuid: string;
  name: string;
  description: string | null;
  type: string;
  stored: number;
  expiresAt: string | null;
};
export type SecurityTab = 'dashboard' | 'servers' | 'threats' | 'secrets';

const TABS: readonly [SecurityTab, keyof SecurityAccount, string][] = [
  ['dashboard', 'Dashboard', 'space_dashboard'],
  ['servers', 'Servers', 'dns'],
  ['threats', 'Threats', 'gpp_maybe'],
  ['secrets', 'Secrets', 'key'],
];
const PAGE = 50;
const METRICS = [
  'servers', 'protectedServers', 'attentionServers', 'openAlerts', 'alerts24h',
  'activeDecisions', 'pendingUnblockRequests', 'vaults', 'secrets',
];
const KNOWN = {
  protection: ['unprotected', 'pending', 'protected', 'partial', 'error'],
  service: ['unknown', 'missing', 'running', 'stopped', 'error'],
  alert: ['open', 'acknowledged', 'resolved', 'ignored'],
  level: ['info', 'warning', 'error', 'critical'],
  request: ['pending', 'approved', 'rejected'],
  secret: ['generic', 'runtime_env', 'api_token', 'password', 'certificate', 'ssh_key', 'database'],
} as const;
/** A revealed value disappears from the screen after this many milliseconds. */
export const REVEAL_VISIBLE_MS = 60_000;

/** Translation key of a server-provided state; unknown values fall back to a neutral label. */
export function stateKey(kind: keyof typeof KNOWN, value: string | null | undefined): string {
  const known = KNOWN[kind] as readonly string[];
  return `security.states.${kind}.${value && known.includes(value) ? value : 'other'}`;
}

/** Whether the customer may ask to lift this block now. */
export function canRequestUnblock(account: SecurityAccount | null, block: Block): boolean {
  return Number(account?.Unblock) === 1 && block.requestStatus !== 'pending';
}

/** Security of the Cyber Security accounts the provider published to this customer, by grant. */
@Component({
  selector: 'mcp-security-page',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'security.title' | transloco }}</h1>
          <p>{{ 'security.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ error()! | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'security.loading' | transloco }}</p>
      } @else if (!error() && accounts().length === 0) {
        <p class="card">{{ 'security.empty' | transloco }}</p>
      }

      @if (accounts().length > 1) {
        <mat-form-field class="account-select">
          <mat-label>{{ 'security.account' | transloco }}</mat-label>
          <mat-select [value]="account()?.CyaUUID" (valueChange)="selectAccount($event)">
            @for (item of accounts(); track item.CyaUUID) {
              <mat-option [value]="item.CyaUUID">{{ item.CyaName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      } @else if (account()) {
        <p class="account-name">{{ account()!.CyaName }}</p>
      }

      @if (account()) {
        <nav class="tabs" [attr.aria-label]="'security.sections' | transloco">
          @for (item of tabs(); track item[0]) {
            <button
              matButton
              type="button"
              [class.active]="tab() === item[0]"
              [attr.aria-pressed]="tab() === item[0]"
              (click)="openTab(item[0])"
            >
              <mat-icon>{{ item[2] }}</mat-icon>{{ 'security.tabs.' + item[0] | transloco }}
            </button>
          }
        </nav>

        @if (notice()) {
          <p class="card notice" role="status">{{ notice()! | transloco }}</p>
        }
        @if (busy()) {
          <p role="status">{{ 'security.loading' | transloco }}</p>
        } @else {
          @switch (tab()) {
            @case ('dashboard') {
              @if (dashboard(); as data) {
                <div class="metrics">
                  @for (metric of metrics; track metric) {
                    <article class="card metric">
                      <span class="metric-value">{{ data[metric] ?? 0 }}</span>
                      <span>{{ 'security.metrics.' + metric | transloco }}</span>
                    </article>
                  }
                </div>
              }
            }
            @case ('servers') {
              @if (servers().length === 0) {
                <p class="card">{{ 'security.emptyServers' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.server' | transloco }}</th>
                        <th scope="col">{{ 'security.protection' | transloco }}</th>
                        <th scope="col">{{ 'security.mode' | transloco }}</th>
                        <th scope="col">{{ 'security.firewall' | transloco }}</th>
                        <th scope="col">{{ 'security.crowdsec' | transloco }}</th>
                        <th scope="col">{{ 'security.bouncer' | transloco }}</th>
                        <th scope="col">{{ 'security.lastSync' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of servers(); track item.uuid) {
                        <tr>
                          <td>
                            {{ item.name }}
                            @if (item.publicIP) { <span class="hint">{{ item.publicIP }}</span> }
                          </td>
                          <td><span class="badge">{{ stateKey('protection', item.protectionStatus) | transloco }}</span></td>
                          <td>{{ (item.mode === 'enforce' ? 'security.modeEnforce' : 'security.modeMonitor') | transloco }}</td>
                          <td>{{ stateKey('service', item.firewallStatus) | transloco }}</td>
                          <td>{{ stateKey('service', item.crowdsecStatus) | transloco }}</td>
                          <td>{{ stateKey('service', item.bouncerStatus) | transloco }}</td>
                          <td>{{ when(item.lastSyncAt) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
            @case ('threats') {
              <h2>{{ 'security.alerts' | transloco }}</h2>
              <div class="toolbar">
                <mat-form-field>
                  <mat-label>{{ 'security.alertStatus' | transloco }}</mat-label>
                  <mat-select [value]="alertStatus()" (valueChange)="alertStatus.set($event); loadAlerts(0)">
                    <mat-option value="">{{ 'security.all' | transloco }}</mat-option>
                    @for (status of alertStatuses; track status) {
                      <mat-option [value]="status">{{ stateKey('alert', status) | transloco }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              @if (alerts().length === 0) {
                <p class="card">{{ 'security.emptyAlerts' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.detectedAt' | transloco }}</th>
                        <th scope="col">{{ 'security.level' | transloco }}</th>
                        <th scope="col">{{ 'security.server' | transloco }}</th>
                        <th scope="col">{{ 'security.sourceIP' | transloco }}</th>
                        <th scope="col">{{ 'security.message' | transloco }}</th>
                        <th scope="col">{{ 'security.alertStatus' | transloco }}</th>
                        @if (canAck()) { <th scope="col"><span class="visually-hidden">{{ 'security.actions' | transloco }}</span></th> }
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of alerts(); track item.uuid) {
                        <tr>
                          <td>{{ when(item.detectedAt) }}</td>
                          <td>{{ stateKey('level', item.level) | transloco }}</td>
                          <td>{{ item.serverName ?? '—' }}</td>
                          <td>{{ item.sourceIP ?? '—' }}</td>
                          <td class="wrap">{{ item.message }}</td>
                          <td><span class="badge">{{ stateKey('alert', item.status) | transloco }}</span></td>
                          @if (canAck()) {
                            <td>
                              @if (item.status === 'open') {
                                <button matButton type="button" (click)="acknowledge(item)">{{ 'security.acknowledge' | transloco }}</button>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <nav class="pagination" [attr.aria-label]="'security.pagination' | transloco">
                  <button matButton type="button" [disabled]="alertOffset() === 0" (click)="loadAlerts(alertOffset() - page)">
                    {{ 'security.previous' | transloco }}
                  </button>
                  <button matButton type="button" [disabled]="alertOffset() + page >= alertTotal()" (click)="loadAlerts(alertOffset() + page)">
                    {{ 'security.next' | transloco }}
                  </button>
                </nav>
              }

              <h2>{{ 'security.blocks' | transloco }}</h2>
              @if (blocks().length === 0) {
                <p class="card">{{ 'security.emptyBlocks' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.blockedIP' | transloco }}</th>
                        <th scope="col">{{ 'security.server' | transloco }}</th>
                        <th scope="col">{{ 'security.scenario' | transloco }}</th>
                        <th scope="col">{{ 'security.expiresAt' | transloco }}</th>
                        <th scope="col">{{ 'security.request' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of blocks(); track item.uuid) {
                        <tr>
                          <td>{{ item.value }}</td>
                          <td>{{ item.serverName ?? '—' }}</td>
                          <td>{{ item.scenario ?? '—' }}</td>
                          <td>{{ item.expiresAt ? when(item.expiresAt) : ('security.noExpiry' | transloco) }}</td>
                          <td>
                            @if (item.requestStatus) {
                              <span class="badge">{{ stateKey('request', item.requestStatus) | transloco }}</span>
                            }
                            @if (canRequestUnblock(account(), item)) {
                              <button matButton type="button" (click)="startRequest(item)">{{ 'security.requestUnblock' | transloco }}</button>
                            }
                          </td>
                        </tr>
                        @if (requesting() === item.uuid) {
                          <tr>
                            <td colspan="5">
                              <form class="request-form" (ngSubmit)="sendRequest(item)">
                                <mat-form-field>
                                  <mat-label>{{ 'security.reason' | transloco }}</mat-label>
                                  <textarea matInput name="reason" rows="3" maxlength="500" [(ngModel)]="reason"></textarea>
                                </mat-form-field>
                                <div class="actions">
                                  <button matButton type="button" (click)="requesting.set(null)">{{ 'security.cancel' | transloco }}</button>
                                  <button matButton="filled" type="submit">{{ 'security.send' | transloco }}</button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
              }

              <h2>{{ 'security.requests' | transloco }}</h2>
              @if (requests().length === 0) {
                <p class="card">{{ 'security.emptyRequests' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.requestedAt' | transloco }}</th>
                        <th scope="col">{{ 'security.blockedIP' | transloco }}</th>
                        <th scope="col">{{ 'security.requestedBy' | transloco }}</th>
                        <th scope="col">{{ 'security.request' | transloco }}</th>
                        <th scope="col">{{ 'security.answer' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of requests(); track item.uuid) {
                        <tr>
                          <td>{{ when(item.createdAt) }}</td>
                          <td>{{ item.value }}</td>
                          <td>{{ item.requestedBy }}</td>
                          <td><span class="badge">{{ stateKey('request', item.status) | transloco }}</span></td>
                          <td class="wrap">{{ item.resolutionNote ?? '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
            @case ('secrets') {
              @if (vaults().length === 0) {
                <p class="card">{{ 'security.emptyVaults' | transloco }}</p>
              } @else {
                <div class="toolbar">
                  <mat-form-field>
                    <mat-label>{{ 'security.vault' | transloco }}</mat-label>
                    <mat-select [value]="vault()" (valueChange)="vault.set($event); loadSecrets()">
                      @for (item of vaults(); track item.uuid) {
                        <mat-option [value]="item.uuid">{{ item.name }} ({{ item.secretsCount }})</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                @if (canReveal()) {
                  <p class="hint">{{ 'security.revealAudit' | transloco }}</p>
                }
                @if (secrets().length === 0) {
                  <p class="card">{{ 'security.emptySecrets' | transloco }}</p>
                } @else {
                  <div class="table-wrap card">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{{ 'security.secret' | transloco }}</th>
                          <th scope="col">{{ 'security.secretType' | transloco }}</th>
                          <th scope="col">{{ 'security.expiresAt' | transloco }}</th>
                          <th scope="col">{{ 'security.value' | transloco }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of secrets(); track item.uuid) {
                          <tr>
                            <td class="wrap">
                              {{ item.name }}
                              @if (item.description) { <span class="hint">{{ item.description }}</span> }
                            </td>
                            <td>{{ stateKey('secret', item.type) | transloco }}</td>
                            <td>{{ item.expiresAt ? when(item.expiresAt) : '—' }}</td>
                            <td>
                              @if (revealed()?.uuid === item.uuid) {
                                <code class="secret-value">{{ revealed()!.value }}</code>
                                <button matIconButton type="button" [attr.aria-label]="'security.copy' | transloco" (click)="copy(revealed()!.value)">
                                  <mat-icon>content_copy</mat-icon>
                                </button>
                                <button matButton type="button" (click)="hide()">{{ 'security.hide' | transloco }}</button>
                              } @else if (!item.stored) {
                                {{ 'security.noValue' | transloco }}
                              } @else if (canReveal()) {
                                <button matButton type="button" (click)="reveal(item)">{{ 'security.reveal' | transloco }}</button>
                              } @else {
                                ••••••
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .page { display: block; }
    .page-header { margin-bottom: 16px; }
    .account-select { width: min(100%, 420px); }
    .account-name { font-weight: 600; margin: 0 0 12px; }
    .tabs, .toolbar, .pagination, .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
    .toolbar mat-form-field { flex: 1 1 200px; min-width: 0; max-width: 420px; }
    .tabs button.active { background: var(--surface-container, rgba(0, 0, 0, 0.06)); font-weight: 600; }
    .pagination, .actions { justify-content: flex-end; }
    h2 { font-size: 1.05rem; margin: 24px 0 8px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .metric { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
    .metric-value { font-size: 1.6rem; font-weight: 600; }
    .table-wrap { overflow-x: auto; }
    .table-wrap.card { padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: start; border-bottom: 1px solid var(--border-color, #eee); white-space: nowrap; }
    td.wrap { white-space: normal; min-width: 220px; overflow-wrap: anywhere; }
    .badge { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 8px; border-radius: 999px; font-size: 0.8rem; background: var(--surface-container, rgba(0, 0, 0, 0.05)); }
    .hint { display: block; margin-top: 2px; font-size: 0.85rem; color: var(--text-secondary, #666); }
    .request-form { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; white-space: normal; }
    .request-form mat-form-field { width: min(100%, 560px); }
    .secret-value { font-family: monospace; overflow-wrap: anywhere; white-space: normal; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `],
})
export class SecurityPageComponent {
  private readonly api = inject(ApiService);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  readonly page = PAGE;
  readonly metrics = METRICS;
  readonly alertStatuses = KNOWN.alert;
  readonly stateKey = stateKey;
  readonly canRequestUnblock = canRequestUnblock;
  readonly accounts = signal<SecurityAccount[]>([]);
  readonly account = signal<SecurityAccount | null>(null);
  readonly tab = signal<SecurityTab>('dashboard');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly servers = signal<Server[]>([]);
  readonly alerts = signal<Alert[]>([]);
  readonly alertStatus = signal('');
  readonly alertOffset = signal(0);
  readonly alertTotal = signal(0);
  readonly blocks = signal<Block[]>([]);
  readonly requests = signal<UnblockRequest[]>([]);
  readonly requesting = signal<string | null>(null);
  readonly vaults = signal<Vault[]>([]);
  readonly vault = signal<string | null>(null);
  readonly secrets = signal<Secret[]>([]);
  readonly revealed = signal<{ uuid: string; value: string } | null>(null);
  readonly tabs = computed(() => {
    const account = this.account();
    return account ? TABS.filter(([, flag]) => Number(account[flag]) === 1) : [];
  });
  readonly canAck = computed(() => Number(this.account()?.AlertAck) === 1);
  readonly canReveal = computed(() => Number(this.account()?.SecretReveal) === 1);
  reason = '';

  constructor() {
    void this.load();
  }

  private base(): string {
    return `customer-portal/cyber-security/accounts/${encodeURIComponent(this.account()!.CyaUUID)}`;
  }

  when(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: SecurityAccount[] }>>('customer-portal/cyber-security/accounts');
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length > 0) await this.selectAccount(items[0].CyaUUID);
    } catch {
      this.error.set('security.error');
    } finally {
      this.loading.set(false);
    }
  }

  async selectAccount(uuid: string) {
    this.account.set(this.accounts().find((item) => item.CyaUUID === uuid) ?? null);
    this.vault.set(null);
    this.hide();
    const first = this.tabs()[0];
    if (first) await this.openTab(first[0]);
  }

  async openTab(tab: SecurityTab) {
    this.tab.set(tab);
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.hide();
    try {
      if (tab === 'dashboard') {
        this.dashboard.set((await this.api.get<ApiEnvelope<Dashboard>>(`${this.base()}/dashboard`)).data ?? null);
      } else if (tab === 'servers') {
        this.servers.set((await this.api.get<ApiEnvelope<{ items: Server[] }>>(`${this.base()}/servers`)).data?.items ?? []);
      } else if (tab === 'threats') {
        await Promise.all([this.loadAlerts(0), this.loadBlocks()]);
      } else {
        const vaults = (await this.api.get<ApiEnvelope<{ items: Vault[] }>>(`${this.base()}/vaults`)).data?.items ?? [];
        this.vaults.set(vaults);
        if (!this.vault() && vaults.length > 0) this.vault.set(vaults[0].uuid);
        await this.loadSecrets();
      }
    } catch {
      this.error.set('security.error');
    } finally {
      this.busy.set(false);
    }
  }

  async loadAlerts(offset: number) {
    const query = new URLSearchParams({ limit: String(PAGE), offset: String(Math.max(0, offset)) });
    if (this.alertStatus()) query.set('status', this.alertStatus());
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Alert[]; total: number }>>(`${this.base()}/alerts?${query}`);
      this.alerts.set(response.data?.items ?? []);
      this.alertTotal.set(Number(response.data?.total ?? 0));
      this.alertOffset.set(Math.max(0, offset));
    } catch {
      this.error.set('security.error');
    }
  }

  async loadBlocks() {
    const [blocks, requests] = await Promise.all([
      this.api.get<ApiEnvelope<{ items: Block[] }>>(`${this.base()}/decisions?limit=200`),
      this.api.get<ApiEnvelope<{ items: UnblockRequest[] }>>(`${this.base()}/unblock-requests?limit=50`),
    ]);
    this.blocks.set(blocks.data?.items ?? []);
    this.requests.set(requests.data?.items ?? []);
  }

  async acknowledge(alert: Alert) {
    this.error.set(null);
    try {
      await this.api.post(`${this.base()}/alerts/${encodeURIComponent(alert.uuid)}/acknowledge`);
      this.notice.set('security.acknowledged');
    } catch {
      this.error.set('security.actionFailed');
    }
    await this.loadAlerts(this.alertOffset());
  }

  startRequest(block: Block) {
    this.reason = '';
    this.requesting.set(block.uuid);
  }

  async sendRequest(block: Block) {
    this.error.set(null);
    try {
      await this.api.post(`${this.base()}/unblock-requests`, {
        decisionUUID: block.uuid,
        reason: this.reason.trim() || null,
      });
      this.requesting.set(null);
      this.notice.set('security.requestSent');
    } catch {
      this.error.set('security.actionFailed');
    }
    await this.loadBlocks().catch(() => this.error.set('security.error'));
  }

  async loadSecrets() {
    const vault = this.vault();
    if (!vault) {
      this.secrets.set([]);
      return;
    }
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Secret[] }>>(`${this.base()}/vaults/${encodeURIComponent(vault)}/secrets`);
      this.secrets.set(response.data?.items ?? []);
    } catch {
      this.error.set('security.error');
    }
  }

  async reveal(secret: Secret) {
    this.error.set(null);
    this.hide();
    try {
      const response = await this.api.post<ApiEnvelope<{ secretValue: string }>>(
        `${this.base()}/secrets/${encodeURIComponent(secret.uuid)}/reveal`,
      );
      const value = response.data?.secretValue;
      if (typeof value !== 'string') throw new Error('empty');
      this.revealed.set({ uuid: secret.uuid, value });
      this.hideTimer = setTimeout(() => this.hide(), REVEAL_VISIBLE_MS);
    } catch {
      this.error.set('security.revealFailed');
    }
  }

  hide() {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.revealed.set(null);
  }

  async copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.notice.set('security.copied');
    } catch {
      this.error.set('security.copyFailed');
    }
  }
}
