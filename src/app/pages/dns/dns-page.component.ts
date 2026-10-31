import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type DnsAccount = {
  DacUUID: string;
  DacName: string;
  DacKind: string;
  DacStatus: number;
  SitesCount: number;
  CreatedAt: string;
};

export type DnsSite = {
  DcsUUID: string;
  DcsName: string;
  DcsAddresses: string;
  DcsSafeSearch: number;
  ClusterName: string | null;
  ClusterAddresses: string | null;
  DcsStatus: number;
};

export type DnsSiteReport = {
  totals: {
    queries: number;
    blocked: number;
    blockedLast24h: number;
    safeSearch: number;
    allowed: number;
    ownRules: number;
  };
};

type AccountsResponse = {
  items: DnsAccount[];
};

type SitesResponse = {
  items: DnsSite[];
};

@Component({
  selector: 'mcp-dns-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'dns.title' | transloco }}</h1>
          <p>{{ 'dns.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'dns.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'dns.loading' | transloco }}</p>
      } @else if (!error() && accounts().length === 0) {
        <p class="card">{{ 'dns.empty' | transloco }}</p>
      }

      @if (accounts().length > 0) {
        <div class="accounts">
          @for (acc of accounts(); track acc.DacUUID) {
            <article
              class="card account"
              [class.selected]="selectedAccount()?.DacUUID === acc.DacUUID"
              (click)="selectAccount(acc)"
            >
              <span class="icon-badge">
                <mat-icon>shield</mat-icon>
              </span>
              <div class="account-details">
                <h2>{{ acc.DacName }}</h2>
                <small class="sites-count">
                  {{ acc.SitesCount }} {{ 'dns.sites' | transloco }}
                </small>
              </div>
              <div class="account-status">
                <span class="badge">{{ 'dns.active' | transloco }}</span>
              </div>
            </article>
          }
        </div>

        @if (loadingSites()) {
          <p role="status">{{ 'dns.loadingSites' | transloco }}</p>
        } @else if (selectedAccount()) {
          <section class="sites-section">
            <h3>{{ 'dns.protectedSites' | transloco }}</h3>
            @if (sites().length === 0) {
              <p class="card">{{ 'dns.emptySites' | transloco }}</p>
            } @else {
              <div class="sites-grid">
                @for (site of sites(); track site.DcsUUID) {
                  <article class="card site-card">
                    <div class="site-header">
                      <span class="icon-badge">
                        <mat-icon>apartment</mat-icon>
                      </span>
                      <div class="site-title">
                        <h4>{{ site.DcsName }}</h4>
                        <span class="site-ips">{{ site.DcsAddresses }}</span>
                      </div>
                    </div>

                    <div class="site-meta">
                      @if (site.ClusterName) {
                        <p class="meta-item">
                          <strong>{{ 'dns.cluster' | transloco }}:</strong> {{ site.ClusterName }}
                          @if (site.ClusterAddresses) {
                            <small>({{ site.ClusterAddresses }})</small>
                          }
                        </p>
                      }
                      <p class="meta-item">
                        <strong>{{ 'dns.safeSearch' | transloco }}:</strong>
                        {{ site.DcsSafeSearch ? ('dns.enabled' | transloco) : ('dns.disabled' | transloco) }}
                      </p>
                    </div>

                    <div class="site-actions">
                      <button
                        mat-button
                        type="button"
                        (click)="toggleReport(site.DcsUUID)"
                      >
                        <mat-icon>insights</mat-icon>
                        {{ 'dns.viewReport' | transloco }}
                      </button>
                    </div>

                    @if (activeReportSite() === site.DcsUUID) {
                      <div class="report-box">
                        @if (loadingReport()) {
                          <p role="status">{{ 'dns.loadingReport' | transloco }}</p>
                        } @else if (reportData()) {
                          <div class="metrics-grid">
                            <div class="metric">
                              <span class="metric-value">{{ reportData()?.totals?.queries ?? 0 }}</span>
                              <span class="metric-label">{{ 'dns.totalQueries' | transloco }}</span>
                            </div>
                            <div class="metric">
                              <span class="metric-value">{{ reportData()?.totals?.blocked ?? 0 }}</span>
                              <span class="metric-label">{{ 'dns.blockedQueries' | transloco }}</span>
                            </div>
                            <div class="metric">
                              <span class="metric-value">{{ reportData()?.totals?.safeSearch ?? 0 }}</span>
                              <span class="metric-label">{{ 'dns.safeSearchQueries' | transloco }}</span>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </article>
                }
              </div>
            }
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .accounts {
      display: grid;
      gap: 16px;
      margin-bottom: 24px;
    }
    .account {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding: 20px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: border-color 0.2s ease;
    }
    .account.selected {
      border-color: var(--primary, #1976d2);
    }
    .account-details {
      min-width: 0;
      flex: 1 1 220px;
      overflow-wrap: anywhere;
    }
    h2 {
      font-size: 1.1rem;
      margin: 0 0 4px;
    }
    .sites-count {
      color: var(--text-secondary, #666);
      font-weight: 500;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
      background: var(--surface-container, rgba(0, 0, 0, 0.05));
    }
    .sites-section {
      margin-top: 24px;
    }
    .sites-section h3 {
      font-size: 1.2rem;
      margin-bottom: 16px;
    }
    .sites-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .site-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .site-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .site-title h4 {
      margin: 0;
      font-size: 1.05rem;
    }
    .site-ips {
      font-size: 0.85rem;
      color: var(--text-secondary, #666);
    }
    .site-meta {
      font-size: 0.9rem;
      border-top: 1px solid var(--border-color, #eee);
      padding-top: 8px;
    }
    .meta-item {
      margin: 4px 0;
    }
    .site-actions {
      display: flex;
      justify-content: flex-end;
    }
    .report-box {
      margin-top: 8px;
      padding: 12px;
      background: var(--surface-container-low, #f9f9f9);
      border-radius: 8px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      text-align: center;
    }
    .metric-value {
      display: block;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--primary, #1976d2);
    }
    .metric-label {
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }
  `],
})
export class DnsPageComponent {
  private readonly api = inject(ApiService);
  readonly accounts = signal<DnsAccount[]>([]);
  readonly selectedAccount = signal<DnsAccount | null>(null);
  readonly sites = signal<DnsSite[]>([]);
  readonly loading = signal(false);
  readonly loadingSites = signal(false);
  readonly loadingReport = signal(false);
  readonly error = signal(false);
  readonly activeReportSite = signal<string | null>(null);
  readonly reportData = signal<DnsSiteReport | null>(null);

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<AccountsResponse>>('customer-portal/dns/accounts');
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length > 0) {
        await this.selectAccount(items[0]);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async selectAccount(account: DnsAccount) {
    this.selectedAccount.set(account);
    this.sites.set([]);
    this.activeReportSite.set(null);
    this.reportData.set(null);
    this.loadingSites.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<SitesResponse>>(
        `customer-portal/dns/sites?accountUUID=${account.DacUUID}`
      );
      this.sites.set(response.data?.items ?? []);
    } catch {
      this.error.set(true);
    } finally {
      this.loadingSites.set(false);
    }
  }

  async toggleReport(siteUUID: string) {
    if (this.activeReportSite() === siteUUID) {
      this.activeReportSite.set(null);
      this.reportData.set(null);
      return;
    }
    this.activeReportSite.set(siteUUID);
    this.loadingReport.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<DnsSiteReport>>(
        `customer-portal/dns/sites/${siteUUID}/report?hours=720`
      );
      this.reportData.set(response.data ?? null);
    } catch {
      this.reportData.set(null);
    } finally {
      this.loadingReport.set(false);
    }
  }
}
