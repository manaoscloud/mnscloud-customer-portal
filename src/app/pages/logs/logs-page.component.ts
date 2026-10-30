import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type LogsAccount = {
  LgaUUID: string;
  LgaID: string;
  LgaName: string;
  ClusterName: string;
  LgaDailyCapMb: number | null;
  LgaWarnPercent: number;
  SourceCount: number;
  UsageTodayMb: number;
  CapState: 'ok' | 'warning' | 'paused';
};

export type LogsSource = {
  LsrUUID: string;
  LsrName: string;
  LsrAddress: string;
  LsrTier: '7d' | '30d' | '90d' | '365d';
  LsrSyslogUdp: number;
  LsrSyslogTcp: number;
  LsrStatus: number;
};

type Items<T> = { items: T[] };

/** Read-only view of the Logs accounts the provider published to this customer. */
@Component({
  selector: 'mcp-logs-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'logs.title' | transloco }}</h1>
          <p>{{ 'logs.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'logs.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'logs.loading' | transloco }}</p>
      } @else if (!error() && accounts().length === 0) {
        <p class="card">{{ 'logs.empty' | transloco }}</p>
      }

      @if (accounts().length > 0) {
        <div class="accounts">
          @for (acc of accounts(); track acc.LgaUUID) {
            <button
              type="button"
              class="card account"
              [class.selected]="selected()?.LgaUUID === acc.LgaUUID"
              [attr.aria-pressed]="selected()?.LgaUUID === acc.LgaUUID"
              (click)="select(acc)"
            >
              <span class="icon-badge"><mat-icon>receipt_long</mat-icon></span>
              <span class="account-details">
                <span class="account-name">{{ acc.LgaName }}</span>
                <small>{{ acc.SourceCount }} {{ 'logs.sources' | transloco }} · {{ acc.ClusterName }}</small>
              </span>
              <span class="usage">
                <span class="usage-value">
                  {{ acc.UsageTodayMb | number: '1.0-2' }}
                  @if (acc.LgaDailyCapMb !== null) {
                    / {{ acc.LgaDailyCapMb | number }}
                  }
                  MB
                </span>
                <span class="badge" [class.warn]="acc.CapState !== 'ok'">
                  {{ 'logs.capStates.' + acc.CapState | transloco }}
                </span>
              </span>
            </button>
          }
        </div>
        <p class="hint">{{ 'logs.usageHint' | transloco }}</p>

        @if (loadingSources()) {
          <p role="status">{{ 'logs.loadingSources' | transloco }}</p>
        } @else if (selected()) {
          <section class="sources">
            <h2>{{ 'logs.sourcesOf' | transloco: { name: selected()!.LgaName } }}</h2>
            @if (sources().length === 0) {
              <p class="card">{{ 'logs.emptySources' | transloco }}</p>
            } @else {
              <div class="table-wrap card">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{{ 'logs.source' | transloco }}</th>
                      <th scope="col">{{ 'logs.address' | transloco }}</th>
                      <th scope="col">{{ 'logs.retention' | transloco }}</th>
                      <th scope="col">{{ 'logs.transports' | transloco }}</th>
                      <th scope="col">{{ 'logs.status' | transloco }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (src of sources(); track src.LsrUUID) {
                      <tr>
                        <td>{{ src.LsrName }}</td>
                        <td class="mono">{{ src.LsrAddress }}</td>
                        <td>{{ 'logs.tiers.' + src.LsrTier | transloco }}</td>
                        <td>{{ transports(src) }}</td>
                        <td>{{ (src.LsrStatus === 1 ? 'logs.active' : 'logs.inactive') | transloco }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
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
      gap: 12px;
    }
    .account {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      width: 100%;
      padding: 16px 20px;
      text-align: start;
      font: inherit;
      color: inherit;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .account.selected {
      border-color: var(--primary, #1976d2);
    }
    .account-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1 1 220px;
      overflow-wrap: anywhere;
    }
    .account-name {
      font-size: 1.05rem;
      font-weight: 600;
    }
    .usage {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .usage-value {
      font-weight: 600;
    }
    .badge {
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
      background: var(--surface-container, rgba(0, 0, 0, 0.05));
    }
    .badge.warn {
      color: var(--error, #b3261e);
    }
    .hint {
      margin: 8px 0 24px;
      font-size: 0.85rem;
      color: var(--text-secondary, #666);
    }
    .sources h2 {
      font-size: 1.1rem;
      margin-bottom: 12px;
    }
    .table-wrap {
      overflow-x: auto;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 10px 12px;
      text-align: start;
      border-bottom: 1px solid var(--border-color, #eee);
      white-space: nowrap;
    }
    .mono {
      font-family: ui-monospace, monospace;
    }
  `],
})
export class LogsPageComponent {
  private readonly api = inject(ApiService);
  readonly accounts = signal<LogsAccount[]>([]);
  readonly selected = signal<LogsAccount | null>(null);
  readonly sources = signal<LogsSource[]>([]);
  readonly loading = signal(false);
  readonly loadingSources = signal(false);
  readonly error = signal(false);

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<Items<LogsAccount>>>('customer-portal/logs/accounts');
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length > 0) await this.select(items[0]);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async select(account: LogsAccount) {
    this.selected.set(account);
    this.sources.set([]);
    this.loadingSources.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<Items<LogsSource>>>(
        `customer-portal/logs/sources?accountUUID=${encodeURIComponent(account.LgaUUID)}`,
      );
      this.sources.set(response.data?.items ?? []);
    } catch {
      this.error.set(true);
    } finally {
      this.loadingSources.set(false);
    }
  }

  transports(source: LogsSource): string {
    return [source.LsrSyslogUdp ? 'UDP' : '', source.LsrSyslogTcp ? 'TCP' : ''].filter(Boolean).join(' / ');
  }
}
