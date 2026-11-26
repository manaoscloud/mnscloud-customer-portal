import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  type CustomerPortalIspCancelResult,
  type CustomerPortalIspChangePlanResult,
  type CustomerPortalIspPlan,
  type CustomerPortalIspSubscription,
  type CustomerPortalIspSubscriptionStatus,
  type CustomerPortalIspTrustUnlockResult,
  speedLabel,
  trafficLabel,
} from './internet.model';

@Component({
  selector: 'mcp-internet-page',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule, TranslocoPipe],
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

      @if (changePlanSuccess()) {
        <p class="card success-banner" role="status">
          <mat-icon>check_circle</mat-icon>
          {{ changePlanSuccess() }}
        </p>
      }

      @if (cancelResult()) {
        <div class="card success-banner" role="status">
          <mat-icon>check_circle</mat-icon>
          <div>
            <strong>{{ 'internet.cancelProtocol' | transloco }} {{ cancelResult()?.protocol }}</strong>
            <p style="margin: 4px 0 0 0;">{{ 'internet.cancelRemovalNotice' | transloco }}</p>
          </div>
        </div>
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
                @if (sub.pendingPlanName) {
                  <span class="badge info">{{ sub.pendingPlanName }}</span>
                }
                <span class="badge" [attr.data-state]="sub.effectiveState">
                  {{ sub.effectiveState }}
                </span>
              </div>
            </div>

            @if (sub.pendingPlanName) {
              <div class="pending-plan-banner">
                <mat-icon>schedule</mat-icon>
                <span>{{ 'internet.pendingPlanChange' | transloco }}: <strong>{{ sub.pendingPlanName }}</strong></span>
              </div>
            }

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

            @if (sub.equipments && sub.equipments.length > 0) {
              <div class="comodato-panel">
                <mat-icon>devices</mat-icon>
                <div class="comodato-info">
                  <strong>{{ 'internet.equipmentComodato' | transloco }}:</strong>
                  @for (eq of sub.equipments; track eq.serialNumber) {
                    <span>{{ eq.serialNumber }} {{ eq.macAddress ? '(' + eq.macAddress + ')' : '' }}</span>
                  }
                </div>
              </div>
            }

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

              @if (sub.effectiveState === 'active' || sub.status === 'active') {
                <button
                  matButton="outlined"
                  type="button"
                  (click)="openChangePlan(sub)"
                >
                  <mat-icon>upgrade</mat-icon>
                  {{ 'internet.changePlanAction' | transloco }}
                </button>

                <button
                  matButton="outlined"
                  color="warn"
                  type="button"
                  (click)="openCancel(sub)"
                >
                  <mat-icon>cancel</mat-icon>
                  {{ 'internet.cancelSubscriptionAction' | transloco }}
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

      <!-- Change Plan Modal -->
      @if (changePlanSub()) {
        <div class="modal-backdrop">
          <div class="modal card">
            <h3>{{ 'internet.changePlanTitle' | transloco }}</h3>
            <p>{{ 'internet.changePlanPrompt' | transloco }}</p>
            @if (loadingPlans()) {
              <div class="field-block">
                <span class="field-label">Carregando planos...</span>
              </div>
            } @else if (eligiblePlans().length === 0) {
              <div class="field-block no-plans">
                <p>{{ 'internet.noEligiblePlans' | transloco }}</p>
              </div>
            } @else {
              <div class="field-block">
                <label class="field-label" for="plan-select">{{ 'internet.selectPlan' | transloco }}</label>
                <select
                  id="plan-select"
                  class="plan-select"
                  [value]="selectedPlanUUID()"
                  (change)="selectedPlanUUID.set($any($event.target).value)"
                >
                  @for (plan of eligiblePlans(); track plan.planUUID) {
                    <option [value]="plan.planUUID">{{ plan.name }} ({{ speed(plan.downloadKbps) }} / {{ speed(plan.uploadKbps) }})</option>
                  }
                </select>
              </div>
            }
            <textarea
              class="notes-input"
              rows="3"
              [value]="changePlanNotes()"
              (input)="changePlanNotes.set($any($event.target).value)"
            ></textarea>
            <div class="modal-actions">
              <button matButton="outlined" type="button" (click)="closeDialogs()" [disabled]="changingPlan()">
                Cancelar
              </button>
              <button matButton="filled" type="button" (click)="submitChangePlan()" [disabled]="changingPlan() || loadingPlans() || !selectedPlanUUID() || eligiblePlans().length === 0">
                {{ 'internet.changePlanSubmit' | transloco }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Cancel Subscription Modal -->
      @if (cancelSub()) {
        <div class="modal-backdrop">
          <div class="modal card">
            <h3>{{ 'internet.cancelDialogTitle' | transloco }}</h3>
            <p class="warning-text">{{ 'internet.cancelDialogWarning' | transloco }}</p>
            <p>{{ 'internet.cancelReasonPrompt' | transloco }}</p>
            <textarea
              class="notes-input"
              rows="3"
              [value]="cancelReason()"
              (input)="cancelReason.set($any($event.target).value)"
            ></textarea>
            <div class="modal-actions">
              <button matButton="outlined" type="button" (click)="closeDialogs()" [disabled]="cancelling()">
                Voltar
              </button>
              <button matButton="filled" color="warn" type="button" (click)="submitCancel()" [disabled]="cancelling()">
                {{ 'internet.cancelConfirm' | transloco }}
              </button>
            </div>
          </div>
        </div>
      }
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
    .comodato-panel {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--mat-sys-surface-container-low);
      font-size: 13px;
    }
    .comodato-info {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
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
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      width: 100%;
      max-width: 480px;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
    .modal h3 {
      margin: 0 0 12px 0;
    }
    .warning-text {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
    .notes-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 6px;
      padding: 8px 12px;
      font-family: inherit;
      font-size: 14px;
      margin: 12px 0;
      resize: vertical;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }
    .pending-plan-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      background: rgba(33, 150, 243, 0.12);
      color: #1976d2;
      border: 1px solid rgba(33, 150, 243, 0.3);
      border-radius: 8px;
      font-size: 14px;
    }
    .field-block {
      margin: 12px 0 8px 0;
      text-align: left;
    }
    .field-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--mat-sys-on-surface);
    }
    .plan-select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 6px;
      padding: 8px 12px;
      font-family: inherit;
      font-size: 14px;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
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

  readonly changePlanSub = signal<CustomerPortalIspSubscription | null>(null);
  readonly changePlanNotes = signal('');
  readonly changePlanSuccess = signal<string | null>(null);
  readonly changingPlan = signal(false);
  readonly loadingPlans = signal(false);
  readonly eligiblePlans = signal<CustomerPortalIspPlan[]>([]);
  readonly selectedPlanUUID = signal<string>('');

  readonly cancelSub = signal<CustomerPortalIspSubscription | null>(null);
  readonly cancelReason = signal('');
  readonly cancelResult = signal<CustomerPortalIspCancelResult | null>(null);
  readonly cancelling = signal(false);

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

  async openChangePlan(sub: CustomerPortalIspSubscription): Promise<void> {
    this.changePlanSub.set(sub);
    this.changePlanNotes.set('');
    this.selectedPlanUUID.set('');
    this.loadingPlans.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: CustomerPortalIspPlan[] }>>(
        `customer-portal/isp/subscriptions/${sub.subscriptionUUID}/eligible-plans`,
      );
      const items = response.data?.items ?? [];
      this.eligiblePlans.set(items);
      this.selectedPlanUUID.set(items[0]?.planUUID ?? '');
    } catch {
      this.eligiblePlans.set([]);
      this.selectedPlanUUID.set('');
    } finally {
      this.loadingPlans.set(false);
    }
  }

  async submitChangePlan(): Promise<void> {
    const sub = this.changePlanSub();
    const planUUID = this.selectedPlanUUID();
    if (!sub || !planUUID || this.eligiblePlans().length === 0) return;
    this.changingPlan.set(true);
    try {
      const response = await this.api.post<ApiEnvelope<{ item: CustomerPortalIspChangePlanResult }>>(
        `customer-portal/isp/subscriptions/${sub.subscriptionUUID}/change-plan`,
        { planUUID, notes: this.changePlanNotes() },
      );
      const pendingName = response.data?.item?.pendingPlanName;
      if (pendingName) {
        this.changePlanSuccess.set(`Alteração para ${pendingName} solicitada com sucesso!`);
        this.subscriptions.update((list) =>
          list.map((item) =>
            item.subscriptionUUID === sub.subscriptionUUID
              ? {
                  ...item,
                  pendingPlanUUID: response.data?.item?.pendingPlanUUID,
                  pendingPlanName: pendingName,
                  pendingPlanDate: response.data?.item?.pendingPlanDate,
                }
              : item,
          ),
        );
      } else {
        this.changePlanSuccess.set('Alteração solicitada com sucesso!');
      }
      this.closeDialogs();
      await this.load();
    } catch {
      this.error.set(true);
    } finally {
      this.changingPlan.set(false);
    }
  }

  openCancel(sub: CustomerPortalIspSubscription): void {
    this.cancelSub.set(sub);
    this.cancelReason.set('');
  }

  async submitCancel(): Promise<void> {
    const sub = this.cancelSub();
    if (!sub) return;
    this.cancelling.set(true);
    try {
      const response = await this.api.post<ApiEnvelope<{ item: CustomerPortalIspCancelResult }>>(
        `customer-portal/isp/subscriptions/${sub.subscriptionUUID}/cancel`,
        { reason: this.cancelReason() || 'Cancelamento solicitado pelo portal' },
      );
      if (response.data?.item) {
        this.cancelResult.set(response.data.item);
      }
      this.closeDialogs();
      await this.load();
    } catch {
      this.error.set(true);
    } finally {
      this.cancelling.set(false);
    }
  }

  closeDialogs(): void {
    this.changePlanSub.set(null);
    this.cancelSub.set(null);
  }
}
