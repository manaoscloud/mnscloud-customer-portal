import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type WebhostHost = {
  HwhUUID: string;
  HwhName: string;
  Domain: string;
  HwhUsername: string;
  HwhStatus: string;
  HwhProvisionStatus: string;
  PlanName: string;
  DiskQuotaMb: number;
  BandwidthQuotaMb: number;
  EmailAccountsMax: number;
  DatabasesMax: number;
  EmailsCount: number;
  DatabasesCount: number;
  ServerIp: string | null;
  Nameservers: string[] | null;
  CanEmails: number;
  CanDatabases: number;
  CanDns: number;
  HwhRevision: string;
  CreatedAt: string;
};

export type WebhostEmail = {
  HweUUID: string;
  HweLocalPart: string;
  Email: string;
  HweQuotaMb: number | null;
  HweStatus: string;
  HweProvisionStatus: string;
  CreatedAt: string;
};

export type WebhostDatabase = {
  HwdUUID: string;
  HwdName: string;
  HwdStatus: string;
  HwdProvisionStatus: string;
  CreatedAt: string;
};

export type WebhostDatabaseUser = {
  HduUUID: string;
  HduName: string;
  HduStatus: string;
  HduProvisionStatus: string;
  CreatedAt: string;
};

export type WebhostDatabaseGrant = {
  HdgUUID: string;
  DatabaseUUID: string;
  DatabaseName: string;
  UserUUID: string;
  UserName: string;
  Privileges: string[];
  HdgStatus: string;
  HdgProvisionStatus: string;
};

export type WebhostDatabaseData = {
  databases: WebhostDatabase[];
  users: WebhostDatabaseUser[];
  grants: WebhostDatabaseGrant[];
};

export type WebhostDnsRecord = {
  HwzUUID: string;
  HwzName: string;
  HwzType: string;
  HwzValue: string;
  HwzPriority: number | null;
  HwzWeight: number | null;
  HwzPort: number | null;
  HwzTtl: number;
  HwzManaged: number;
  HwzStatus: string;
  HwzProvisionStatus: string;
  CreatedAt: string;
};

type HostsResponse = {
  items: WebhostHost[];
};

type EmailsResponse = {
  items: WebhostEmail[];
};

type DnsResponse = {
  items: WebhostDnsRecord[];
};

@Component({
  selector: 'mcp-webhost-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'webhost.title' | transloco }}</h1>
          <p>{{ 'webhost.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'webhost.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'webhost.loading' | transloco }}</p>
      } @else if (!error() && hosts().length === 0) {
        <p class="card">{{ 'webhost.empty' | transloco }}</p>
      }

      @if (hosts().length > 0) {
        <div class="hosts-grid">
          @for (host of hosts(); track host.HwhUUID) {
            <article
              class="card host-card"
              [class.selected]="selectedHost()?.HwhUUID === host.HwhUUID"
              (click)="selectHost(host)"
            >
              <div class="host-header">
                <span class="icon-badge">
                  <mat-icon>language</mat-icon>
                </span>
                <div class="host-titles">
                  <h2>{{ host.Domain }}</h2>
                  <small>{{ host.HwhName }} · {{ host.PlanName }}</small>
                </div>
              </div>
              <div class="host-status">
                <span class="badge" [class.badge-active]="host.HwhStatus === 'active'">
                  {{ host.HwhStatus === 'active' ? ('webhost.status.active' | transloco) : host.HwhStatus }}
                </span>
              </div>
            </article>
          }
        </div>

        @if (selectedHost(); as current) {
          <section class="host-details">
            <mat-tab-group animationDuration="0ms">
              <!-- Aba: Visão Geral -->
              <mat-tab [label]="'webhost.tab.overview' | transloco">
                <div class="tab-content">
                  <div class="specs-grid">
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.domain' | transloco }}</span>
                      <strong class="spec-value">{{ current.Domain }}</strong>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.plan' | transloco }}</span>
                      <strong class="spec-value">{{ current.PlanName }}</strong>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.disk' | transloco }}</span>
                      <strong class="spec-value">{{ current.DiskQuotaMb }} MB</strong>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.bandwidth' | transloco }}</span>
                      <strong class="spec-value">{{ current.BandwidthQuotaMb }} MB</strong>
                    </div>
                    @if (current.ServerIp) {
                      <div class="spec-item">
                        <span class="spec-label">{{ 'webhost.specs.serverIp' | transloco }}</span>
                        <strong class="spec-value">{{ current.ServerIp }}</strong>
                      </div>
                    }
                    @if (current.Nameservers && current.Nameservers.length > 0) {
                      <div class="spec-item full-width">
                        <span class="spec-label">{{ 'webhost.specs.nameservers' | transloco }}</span>
                        <strong class="spec-value">{{ current.Nameservers.join(', ') }}</strong>
                      </div>
                    }
                  </div>
                </div>
              </mat-tab>

              <!-- Aba: E-mails -->
              @if (current.CanEmails) {
                <mat-tab [label]="'webhost.tab.emails' | transloco">
                  <div class="tab-content">
                    @if (loadingSub()) {
                      <p role="status">{{ 'webhost.loading' | transloco }}</p>
                    } @else if (emails().length === 0) {
                      <p class="card">{{ 'webhost.emails.empty' | transloco }}</p>
                    } @else {
                      <div class="resource-list">
                        @for (mail of emails(); track mail.HweUUID) {
                          <div class="card resource-item">
                            <div class="resource-main">
                              <mat-icon class="resource-icon">mail</mat-icon>
                              <div>
                                <strong>{{ mail.Email }}</strong>
                                <small>Quota: {{ mail.HweQuotaMb ? mail.HweQuotaMb + ' MB' : ('webhost.quotaUnlimited' | transloco) }}</small>
                              </div>
                            </div>
                            <span class="badge" [class.badge-active]="mail.HweStatus === 'active'">
                              {{ mail.HweStatus === 'active' ? ('webhost.status.active' | transloco) : mail.HweStatus }}
                            </span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </mat-tab>
              }

              <!-- Aba: Bancos de Dados -->
              @if (current.CanDatabases) {
                <mat-tab [label]="'webhost.tab.databases' | transloco">
                  <div class="tab-content">
                    @if (loadingSub()) {
                      <p role="status">{{ 'webhost.loading' | transloco }}</p>
                    } @else if (databases()?.databases?.length === 0 && databases()?.users?.length === 0) {
                      <p class="card">{{ 'webhost.databases.empty' | transloco }}</p>
                    } @else {
                      <div class="db-section">
                        <h4>{{ 'webhost.databases.title' | transloco }}</h4>
                        <div class="resource-list">
                          @for (db of databases()?.databases; track db.HwdUUID) {
                            <div class="card resource-item">
                              <div class="resource-main">
                                <mat-icon class="resource-icon">storage</mat-icon>
                                <strong>{{ db.HwdName }}</strong>
                              </div>
                              <span class="badge" [class.badge-active]="db.HwdStatus === 'active'">{{ db.HwdStatus }}</span>
                            </div>
                          }
                        </div>

                        <h4 class="mt-4">{{ 'webhost.databases.users' | transloco }}</h4>
                        <div class="resource-list">
                          @for (user of databases()?.users; track user.HduUUID) {
                            <div class="card resource-item">
                              <div class="resource-main">
                                <mat-icon class="resource-icon">person</mat-icon>
                                <strong>{{ user.HduName }}</strong>
                              </div>
                              <span class="badge" [class.badge-active]="user.HduStatus === 'active'">{{ user.HduStatus }}</span>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </mat-tab>
              }

              <!-- Aba: DNS -->
              @if (current.CanDns) {
                <mat-tab [label]="'webhost.tab.dns' | transloco">
                  <div class="tab-content">
                    @if (loadingSub()) {
                      <p role="status">{{ 'webhost.loading' | transloco }}</p>
                    } @else if (dnsRecords().length === 0) {
                      <p class="card">{{ 'webhost.dns.empty' | transloco }}</p>
                    } @else {
                      <div class="resource-list">
                        @for (rec of dnsRecords(); track rec.HwzUUID) {
                          <div class="card resource-item">
                            <div class="resource-main">
                              <span class="dns-type-tag">{{ rec.HwzType }}</span>
                              <div>
                                <strong>{{ rec.HwzName }}</strong>
                                <small>{{ rec.HwzValue }} (TTL: {{ rec.HwzTtl }})</small>
                              </div>
                            </div>
                            <span class="badge" [class.badge-active]="rec.HwzStatus === 'active'">{{ rec.HwzStatus }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </mat-tab>
              }

              <!-- Aba: Suporte -->
              <mat-tab [label]="'webhost.tab.support' | transloco">
                <div class="tab-content">
                  <div class="card support-box">
                    <mat-icon class="support-icon">support_agent</mat-icon>
                    <div>
                      <h3>{{ 'webhost.support.title' | transloco }}</h3>
                      <p>{{ 'webhost.support.text' | transloco }}</p>
                    </div>
                  </div>
                </div>
              </mat-tab>
            </mat-tab-group>
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { margin: 0 0 4px 0; font-size: 1.75rem; }
    .page-header p { margin: 0; color: var(--mat-sys-on-surface-variant, #666); }
    .hosts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .host-card {
      padding: 16px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
    }
    .host-card.selected {
      border-color: var(--mat-sys-primary, #1976d2);
      box-shadow: 0 0 0 1px var(--mat-sys-primary, #1976d2);
    }
    .host-header { display: flex; align-items: center; gap: 12px; }
    .icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, #f5f5f5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-primary, #1976d2);
    }
    .host-titles h2 { margin: 0; font-size: 1rem; font-weight: 600; }
    .host-titles small { color: var(--mat-sys-on-surface-variant, #666); }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      background: var(--mat-sys-surface-container, #eee);
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .badge.badge-active { background: #e8f5e9; color: #2e7d32; }
    .host-details { margin-top: 16px; }
    .tab-content { padding: 24px 0; }
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }
    .spec-item {
      padding: 16px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-low, #fafafa);
      border: 1px solid var(--mat-sys-outline-variant, #eee);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .spec-item.full-width { grid-column: 1 / -1; }
    .spec-label { font-size: 0.75rem; color: var(--mat-sys-on-surface-variant, #666); }
    .spec-value { font-size: 1rem; }
    .resource-list { display: flex; flex-direction: column; gap: 8px; }
    .resource-item {
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--mat-sys-outline-variant, #eee);
    }
    .resource-main { display: flex; align-items: center; gap: 12px; }
    .resource-icon { color: var(--mat-sys-primary, #1976d2); }
    .resource-main div { display: flex; flex-direction: column; }
    .resource-main small { color: var(--mat-sys-on-surface-variant, #666); }
    .dns-type-tag {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--mat-sys-secondary-container, #e3f2fd);
      color: var(--mat-sys-on-secondary-container, #1565c0);
      min-width: 44px;
      text-align: center;
    }
    .mt-4 { margin-top: 24px; margin-bottom: 8px; }
    .support-box {
      padding: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      background: var(--mat-sys-surface-container-low, #fafafa);
      border: 1px solid var(--mat-sys-outline-variant, #eee);
    }
    .support-icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary, #1976d2); }
    .support-box h3 { margin: 0 0 8px 0; }
    .support-box p { margin: 0; color: var(--mat-sys-on-surface-variant, #666); }
  `],
})
export class WebhostPageComponent {
  private readonly api = inject(ApiService);

  readonly hosts = signal<WebhostHost[]>([]);
  readonly selectedHost = signal<WebhostHost | null>(null);
  readonly emails = signal<WebhostEmail[]>([]);
  readonly databases = signal<WebhostDatabaseData | null>(null);
  readonly dnsRecords = signal<WebhostDnsRecord[]>([]);

  readonly loading = signal(false);
  readonly loadingSub = signal(false);
  readonly error = signal(false);

  constructor() {
    void this.loadHosts();
  }

  async loadHosts(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<HostsResponse>>('customer-portal/webhost/hosts');
      const items = response.data?.items ?? [];
      this.hosts.set(items);
      if (items.length > 0) {
        this.selectHost(items[0]);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  selectHost(host: WebhostHost): void {
    this.selectedHost.set(host);
    void this.loadHostDetails(host);
  }

  async loadHostDetails(host: WebhostHost): Promise<void> {
    this.loadingSub.set(true);
    try {
      if (host.CanEmails) {
        const res = await this.api.get<ApiEnvelope<EmailsResponse>>(
          `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/emails`,
        );
        this.emails.set(res.data?.items ?? []);
      } else {
        this.emails.set([]);
      }

      if (host.CanDatabases) {
        const res = await this.api.get<ApiEnvelope<WebhostDatabaseData>>(
          `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases`,
        );
        this.databases.set(res.data ?? { databases: [], users: [], grants: [] });
      } else {
        this.databases.set(null);
      }

      if (host.CanDns) {
        const res = await this.api.get<ApiEnvelope<DnsResponse>>(
          `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/dns`,
        );
        this.dnsRecords.set(res.data?.items ?? []);
      } else {
        this.dnsRecords.set([]);
      }
    } catch {
      // Sub-resource failure does not fail the whole page
    } finally {
      this.loadingSub.set(false);
    }
  }
}
