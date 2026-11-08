import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type VoipAccount = {
  VpaUUID: string;
  VpaName: string;
  VpaKind: string;
  VpaNotes: string | null;
  ExtensionsCount: number;
  TrunksCount: number;
  QueuesCount: number;
  CreatedAt: string;
};

export type VoipExtension = {
  VpeUUID: string;
  VpeExtension: string;
  VpeName: string;
  VpeKind: string;
  VpeStatus: number;
  VpeCallerIdExternal: string | null;
  VpeCallerIdInternal: string | null;
};

export type VoipCdr = {
  VcdUUID: string;
  VcdDirection: string;
  VcdSource: string;
  VcdDestination: string;
  VcdDurationSeconds: number;
  VcdBillsec: number;
  VcdDisposition: string;
  VcdStartTime: string;
  VcdEndTime: string | null;
};

type AccountsResponse = {
  items: VoipAccount[];
};

type ExtensionsResponse = {
  items: VoipExtension[];
};

type CdrsResponse = {
  items: VoipCdr[];
};

type Tab = 'extensions' | 'cdrs';

@Component({
  selector: 'mcp-voip-page',
  standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule, MatCardModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'voip.title' | transloco }}</h1>
          <p>{{ 'voip.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'voip.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'voip.loading' | transloco }}</p>
      } @else if (!error() && accounts().length === 0) {
        <p class="card">{{ 'voip.empty' | transloco }}</p>
      }

      @if (accounts().length > 0) {
        <div class="accounts">
          @for (acc of accounts(); track acc.VpaUUID) {
            <article
              class="card account"
              [class.selected]="selectedAccount()?.VpaUUID === acc.VpaUUID"
              (click)="selectAccount(acc)"
            >
              <span class="icon-badge">
                <mat-icon>phone_in_talk</mat-icon>
              </span>
              <div class="account-details">
                <h2>{{ acc.VpaName }}</h2>
                <div class="meta-row">
                  <small class="counter">{{ acc.ExtensionsCount }} {{ 'voip.extensions' | transloco }}</small>
                  <small class="counter">{{ acc.QueuesCount }} {{ 'voip.queues' | transloco }}</small>
                  <small class="counter">{{ acc.TrunksCount }} {{ 'voip.trunks' | transloco }}</small>
                </div>
              </div>
              <div class="account-status">
                <span class="badge">{{ 'voip.active' | transloco }}</span>
              </div>
            </article>
          }
        </div>

        @if (selectedAccount(); as acc) {
          <section class="details-section">
            <header class="details-header">
              <h3>{{ acc.VpaName }}</h3>
              <nav class="tabs" role="tablist">
                <button
                  matButton
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeTab() === 'extensions'"
                  [class.active-tab]="activeTab() === 'extensions'"
                  (click)="setTab('extensions')"
                >
                  <mat-icon>contacts</mat-icon>
                  {{ 'voip.tabExtensions' | transloco }}
                </button>
                <button
                  matButton
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeTab() === 'cdrs'"
                  [class.active-tab]="activeTab() === 'cdrs'"
                  (click)="setTab('cdrs')"
                >
                  <mat-icon>history</mat-icon>
                  {{ 'voip.tabCdrs' | transloco }}
                </button>
              </nav>
            </header>

            @if (activeTab() === 'extensions') {
              @if (loadingExtensions()) {
                <p role="status">{{ 'voip.loadingExtensions' | transloco }}</p>
              } @else if (extensions().length === 0) {
                <p class="card">{{ 'voip.emptyExtensions' | transloco }}</p>
              } @else {
                <div class="table-container card">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>{{ 'voip.extensionNumber' | transloco }}</th>
                        <th>{{ 'voip.extensionName' | transloco }}</th>
                        <th>{{ 'voip.extensionCallerId' | transloco }}</th>
                        <th>{{ 'voip.extensionKind' | transloco }}</th>
                        <th>{{ 'voip.extensionStatus' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (ext of extensions(); track ext.VpeUUID) {
                        <tr>
                          <td><strong>{{ ext.VpeExtension }}</strong></td>
                          <td>{{ ext.VpeName }}</td>
                          <td>{{ ext.VpeCallerIdExternal || ext.VpeCallerIdInternal || '—' }}</td>
                          <td><span class="badge">{{ ext.VpeKind }}</span></td>
                          <td>
                            <span class="badge" [class.badge-active]="ext.VpeStatus === 1">
                              {{ ext.VpeStatus === 1 ? ('voip.active' | transloco) : ('voip.inactive' | transloco) }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }

            @if (activeTab() === 'cdrs') {
              @if (loadingCdrs()) {
                <p role="status">{{ 'voip.loadingCdrs' | transloco }}</p>
              } @else if (cdrs().length === 0) {
                <p class="card">{{ 'voip.emptyCdrs' | transloco }}</p>
              } @else {
                <div class="table-container card">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>{{ 'voip.cdrDate' | transloco }}</th>
                        <th>{{ 'voip.cdrSource' | transloco }}</th>
                        <th>{{ 'voip.cdrDestination' | transloco }}</th>
                        <th>{{ 'voip.cdrDirection' | transloco }}</th>
                        <th>{{ 'voip.cdrDuration' | transloco }}</th>
                        <th>{{ 'voip.cdrDisposition' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (cdr of cdrs(); track cdr.VcdUUID) {
                        <tr>
                          <td>{{ cdr.VcdStartTime | date: 'short' }}</td>
                          <td>{{ cdr.VcdSource }}</td>
                          <td>{{ cdr.VcdDestination }}</td>
                          <td><span class="badge">{{ cdr.VcdDirection }}</span></td>
                          <td>{{ cdr.VcdBillsec }}s</td>
                          <td>
                            <span class="badge" [class.badge-active]="cdr.VcdDisposition === 'ANSWERED'">
                              {{ cdr.VcdDisposition }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
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
    .meta-row {
      display: flex;
      gap: 12px;
      margin-top: 4px;
    }
    .counter {
      color: var(--text-secondary, #666);
      font-weight: 500;
    }
    h2 {
      font-size: 1.1rem;
      margin: 0 0 4px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
      background: var(--surface-container, rgba(0, 0, 0, 0.05));
    }
    .badge-active {
      background: rgba(46, 125, 50, 0.15);
      color: #2e7d32;
    }
    .details-section {
      margin-top: 24px;
    }
    .details-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
    }
    .tabs {
      display: flex;
      gap: 8px;
    }
    .active-tab {
      background-color: var(--surface-container-high, rgba(0, 0, 0, 0.08));
    }
    .table-container {
      overflow-x: auto;
      padding: 0;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .data-table th, .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--outline-variant, rgba(0, 0, 0, 0.08));
    }
    .data-table th {
      font-weight: 600;
      background: var(--surface-container-low, rgba(0, 0, 0, 0.02));
    }
  `],
})
export class VoipPageComponent {
  private readonly api = inject(ApiService);

  readonly accounts = signal<VoipAccount[]>([]);
  readonly selectedAccount = signal<VoipAccount | null>(null);
  readonly activeTab = signal<Tab>('extensions');

  readonly extensions = signal<VoipExtension[]>([]);
  readonly cdrs = signal<VoipCdr[]>([]);

  readonly loading = signal(true);
  readonly loadingExtensions = signal(false);
  readonly loadingCdrs = signal(false);
  readonly error = signal(false);

  constructor() {
    void this.loadAccounts();
  }

  async loadAccounts() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<AccountsResponse>>('customer-portal/voip/accounts');
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length > 0 && !this.selectedAccount()) {
        await this.selectAccount(items[0]);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async selectAccount(account: VoipAccount) {
    this.selectedAccount.set(account);
    await this.refreshTab(account.VpaUUID);
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    const acc = this.selectedAccount();
    if (acc) {
      void this.refreshTab(acc.VpaUUID);
    }
  }

  private async refreshTab(accountUUID: string) {
    if (this.activeTab() === 'extensions') {
      await this.loadExtensions(accountUUID);
    } else {
      await this.loadCdrs(accountUUID);
    }
  }

  async loadExtensions(accountUUID: string) {
    this.loadingExtensions.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<ExtensionsResponse>>(
        `customer-portal/voip/extensions?accountUUID=${accountUUID}`
      );
      this.extensions.set(response.data?.items ?? []);
    } catch {
      this.extensions.set([]);
    } finally {
      this.loadingExtensions.set(false);
    }
  }

  async loadCdrs(accountUUID: string) {
    this.loadingCdrs.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<CdrsResponse>>(
        `customer-portal/voip/cdrs?accountUUID=${accountUUID}`
      );
      this.cdrs.set(response.data?.items ?? []);
    } catch {
      this.cdrs.set([]);
    } finally {
      this.loadingCdrs.set(false);
    }
  }
}
