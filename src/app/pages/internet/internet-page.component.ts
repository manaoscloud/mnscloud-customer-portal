import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  type CustomerPortalIspSubscription,
  type CustomerPortalIspSubscriptionStatus,
  type CustomerPortalIspTrustUnlockResult,
  speedLabel,
  trafficLabel,
} from './internet.model';

@Component({
  selector: 'mcp-internet-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'internet.title' | transloco }}</h1>
          <p>{{ 'internet.description' | transloco }}</p>
        </div>
        <button matButton="outlined" type="button" (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          {{ 'internet.refresh' | transloco }}
        </button>
      </header>

      @if (unlockSuccess()) {
        <p class="card success-banner" role="status">
          <mat-icon>check_circle</mat-icon>
          {{ 'internet.trustUnlockSuccess' | transloco }}
        </p>
      }

      @if (error()) {
        <p class="card notice" role="alert">{{ 'internet.error' | transloco }}</p>
      } @else if (loading() && subscriptions().length === 0) {
        <p role="status">{{ 'internet.loading' | transloco }}</p>
      } @else if (subscriptions().length === 0) {
        <div class="card empty-state">
          <mat-icon>wifi_off</mat-icon>
          <p>{{ 'internet.empty' | transloco }}</p>
        </div>
      }

      <div class="subscriptions">
        @for (sub of subscriptions(); track sub.subscriptionUUID) {
          <article class="card subscription-card">
            <div class="head">
              <span class="icon-badge">
                <mat-icon>{{ sub.technology === 'FTTH' ? 'router' : 'wifi' }}</mat-icon>
              </span>
              <div class="name">
                <h2>{{ sub.planName }}</h2>
                <small>
                  #{{ sub.subscriptionID }} · {{ speed(sub.downloadKbps) }} / {{ speed(sub.uploadKbps) }}
                  @if (sub.technology) {
                    · {{ sub.technology }}
                  }
                </small>
              </div>

              <div class="badges">
                @if (sub.dunningBlocked === 1) {
                  <span class="badge danger">{{ 'internet.dunningBlocked' | transloco }}</span>
                }
                @if (sub.trustUnlockActive === 1) {
                  <span class="badge warning">{{ 'internet.trustUnlockActive' | transloco }}</span>
                }
                <span class="badge" [attr.data-state]="sub.effectiveState">
                  {{ sub.effectiveState }}
                </span>
              </div>
            </div>

            <div class="details-grid">
              <div class="detail-item">
                <span class="label">{{ 'internet.address' | transloco }}</span>
                <span class="value">
                  {{ sub.addressStreet }}, {{ sub.addressNumber }}
                  @if (sub.addressDistrict) {
                    - {{ sub.addressDistrict }}
                  }
                  @if (sub.addressCity) {
                    , {{ sub.addressCity }} - {{ sub.addressState }}
                  }
                </span>
              </div>

              <div class="detail-item">
                <span class="label">{{ 'internet.ipAddress' | transloco }}</span>
                <span class="value">{{ sub.framedIp ?? ('internet.dynamicIp' | transloco) }}</span>
              </div>

              @if (sub.accessUsername) {
                <div class="detail-item">
                  <span class="label">{{ 'internet.username' | transloco }}</span>
                  <span class="value">{{ sub.accessUsername }}</span>
                </div>
              }
            </div>

            <!-- Connection Status Panel -->
            @if (statuses()[sub.subscriptionUUID]; as st) {
              <div class="status-panel">
                <div class="status-indicator" [class.online]="st.isOnline === 1">
                  <span class="dot"></span>
                  <strong>
                    {{ (st.isOnline === 1 ? 'internet.online' : 'internet.offline') | transloco }}
                  </strong>
                </div>
                <div class="status-metrics">
                  <span>
                    {{ 'internet.trafficMonth' | transloco }}:
                    ↓ {{ traffic(st.monthlyDownloadBytes) }} · ↑ {{ traffic(st.monthlyUploadBytes) }}
                  </span>
                </div>
              </div>
            }

            <div class="actions">
              @if (sub.dunningBlocked === 1 && sub.trustUnlockActive !== 1) {
                <button
                  matButton="filled"
                  color="warn"
                  type="button"
                  (click)="unlock(sub)"
                  [disabled]="unlocking() === sub.subscriptionUUID"
                >
                  <mat-icon>lock_open</mat-icon>
                  {{ 'internet.trustUnlockAction' | transloco }}
                </button>
              }

              <a matButton="outlined" routerLink="/financial">
                <mat-icon>receipt_long</mat-icon>
                {{ 'internet.financialLink' | transloco }}
              </a>

              <a matButton="outlined" routerLink="/teste">
                <mat-icon>speed</mat-icon>
                {{ 'internet.connectionTestLink' | transloco }}
              </a>

              <a matButton="outlined" routerLink="/support">
                <mat-icon>support_agent</mat-icon>
                {{ 'internet.supportLink' | transloco }}
              </a>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .notice {
      padding: 16px;
      color: var(--mat-sys-error);
    }
    .success-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .subscriptions {
      display: grid;
      gap: 16px;
    }
    .subscription-card {
      display: grid;
      gap: 16px;
      padding: 20px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .name {
      flex: 1 1 auto;
      min-width: 0;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 650;
    }
    small {
      color: var(--muted);
    }
    .badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .badge {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: var(--mat-sys-surface-container-high);
    }
    .badge[data-state='active'] {
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .badge[data-state='suspended'] {
      color: var(--mat-sys-on-error-container);
      background: var(--mat-sys-error-container);
    }
    .badge.danger {
      color: var(--mat-sys-on-error-container);
      background: var(--mat-sys-error-container);
    }
    .badge.warning {
      color: #92400e;
      background: #fef3c7;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      padding: 12px 0;
      border-top: 1px solid var(--mat-sys-outline-variant);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .detail-item .label {
      font-size: 12px;
      color: var(--muted);
    }
    .detail-item .value {
      font-size: 14px;
      font-weight: 500;
    }
    .status-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container);
      flex-wrap: wrap;
      gap: 8px;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-error);
    }
    .status-indicator.online {
      color: #16a34a;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: currentColor;
    }
    .status-metrics {
      font-size: 13px;
      color: var(--muted);
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
  `,
})
export class InternetPageComponent {
  private readonly api = inject(ApiService);
  readonly subscriptions = signal<CustomerPortalIspSubscription[]>([]);
  readonly statuses = signal<Record<string, CustomerPortalIspSubscriptionStatus>>({});
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly unlocking = signal<string | null>(null);
  readonly unlockSuccess = signal(false);

  readonly speed = speedLabel;
  readonly traffic = trafficLabel;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: CustomerPortalIspSubscription[] }>>(
        'customer-portal/isp/subscriptions',
      );
      const items = response.data?.items ?? [];
      this.subscriptions.set(items);
      for (const item of items) {
        void this.loadStatus(item.subscriptionUUID);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async loadStatus(uuid: string): Promise<void> {
    try {
      const response = await this.api.get<ApiEnvelope<{ status: CustomerPortalIspSubscriptionStatus }>>(
        `customer-portal/isp/subscriptions/${uuid}/status`,
      );
      if (response.data?.status) {
        this.statuses.update((prev) => ({ ...prev, [uuid]: response.data!.status }));
      }
    } catch {
      // status unavailable
    }
  }

  async unlock(sub: CustomerPortalIspSubscription): Promise<void> {
    this.unlocking.set(sub.subscriptionUUID);
    try {
      await this.api.post<ApiEnvelope<{ result: CustomerPortalIspTrustUnlockResult }>>(
        `customer-portal/isp/subscriptions/${sub.subscriptionUUID}/trust-unlock`,
        { reason: 'Customer portal trust unlock request' },
      );
      await this.load();
      this.unlockSuccess.set(true);
    } catch {
      this.error.set(true);
    } finally {
      this.unlocking.set(null);
    }
  }
}
