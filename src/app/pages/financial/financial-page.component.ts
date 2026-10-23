import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type CustomerBoleto = {
  uuid: string;
  id: string;
  title: string;
  amount: number;
  status: string;
  dueDate: string;
  notes: string | null;
  gatewayStatus: string | null;
  barcode: string | null;
  digitableLine: string | null;
  pixCopyPaste: string | null;
  boletoUrl: string | null;
  invoiceUrl: string | null;
  dateCreated: string;
};

@Component({
  selector: 'mcp-financial-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'financial.eyebrow' | transloco }}</span>
          <h1>{{ 'financial.title' | transloco }}</h1>
          <p>{{ 'financial.subtitle' | transloco }}</p>
        </div>
      </header>

      @if (loading()) {
        <div class="empty-state card">
          <mat-progress-spinner mode="indeterminate" diameter="40" />
          <p>{{ 'financial.loading' | transloco }}</p>
        </div>
      } @else if (boletos().length === 0) {
        <div class="empty-state card">
          <span class="icon-badge success"><mat-icon>check_circle</mat-icon></span>
          <h2>{{ 'financial.emptyTitle' | transloco }}</h2>
          <p>{{ 'financial.emptyText' | transloco }}</p>
        </div>
      } @else {
        <div class="boletos-grid">
          @for (boleto of boletos(); track boleto.uuid) {
            <article class="boleto-card card" [class.is-paid]="boleto.status === 'paid'" [class.is-overdue]="boleto.status === 'overdue'">
              <div class="card-header">
                <div>
                  <span class="boleto-id">#{{ boleto.id }}</span>
                  <h3 class="boleto-title">{{ boleto.title || ('financial.chargeFallback' | transloco) }}</h3>
                </div>
                <span class="status-badge" [class]="'status-' + boleto.status">
                  {{ statusLabel(boleto.status) }}
                </span>
              </div>

              <div class="card-body">
                <div class="info-row">
                  <span class="label">{{ 'financial.amount' | transloco }}</span>
                  <strong class="amount">{{ formatCurrency(boleto.amount) }}</strong>
                </div>
                <div class="info-row">
                  <span class="label">{{ 'financial.dueDate' | transloco }}</span>
                  <span class="value">{{ formatDate(boleto.dueDate) }}</span>
                </div>
              </div>

              @if (boleto.status !== 'paid' && boleto.status !== 'canceled') {
                <div class="card-actions">
                  @if (boleto.pixCopyPaste) {
                    <button matButton="tonal" type="button" (click)="copyToClipboard(boleto.pixCopyPaste, 'financial.pixCopyPaste')">
                      <mat-icon>qr_code</mat-icon>
                      {{ 'financial.copyPix' | transloco }}
                    </button>
                  }

                  @if (boleto.digitableLine) {
                    <button matButton="outlined" type="button" (click)="copyToClipboard(boleto.digitableLine, 'financial.digitableLine')">
                      <mat-icon>content_copy</mat-icon>
                      {{ 'financial.digitableLine' | transloco }}
                    </button>
                  }

                  @if (boleto.boletoUrl) {
                    <a matButton="outlined" [href]="boleto.boletoUrl" target="_blank" rel="noopener noreferrer">
                      <mat-icon>description</mat-icon>
                      {{ 'financial.boletoPdf' | transloco }}
                    </a>
                  }

                  @if (boleto.invoiceUrl) {
                    <a matButton="filled" [href]="boleto.invoiceUrl" target="_blank" rel="noopener noreferrer">
                      <mat-icon>credit_card</mat-icon>
                      {{ 'financial.payByCard' | transloco }}
                    </a>
                  }
                </div>
              }
            </article>
          }
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .icon-badge.success {
      color: var(--success);
      background: var(--success-container);
    }
    .boletos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
      gap: 16px;
    }
    .boleto-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      &.is-paid {
        border-left: 4px solid var(--success);
      }
      &.is-overdue {
        border-left: 4px solid var(--danger);
      }
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .boleto-id {
      font-size: 0.75rem;
      font-family: ui-monospace, monospace;
      color: var(--muted);
    }
    .boleto-title {
      margin: 2px 0 0;
      font-size: 1.05rem;
      font-weight: 650;
    }
    .status-badge {
      flex: none;
      font-size: 0.75rem;
      font-weight: 650;
      padding: 4px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      color: var(--muted);
      background: var(--neutral-container);
      &.status-open {
        color: var(--warning);
        background: var(--warning-container);
      }
      &.status-paid {
        color: var(--success);
        background: var(--success-container);
      }
      &.status-overdue {
        color: var(--danger);
        background: var(--danger-container);
      }
    }
    .card-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .label {
        font-size: 0.875rem;
        color: var(--muted);
      }
      .amount {
        font-size: 1.25rem;
        font-weight: 700;
      }
      .value {
        font-size: 0.875rem;
        font-weight: 550;
      }
    }
    .card-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      .mat-mdc-button-base {
        min-width: 0;
        padding-inline: 10px;
        white-space: nowrap;
      }
    }
  `]
})
export class FinancialPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(PortalI18nService);
  readonly boletos = signal<CustomerBoleto[]>([]);
  readonly loading = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    await this.loadBoletos();
  }

  async loadBoletos(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: CustomerBoleto[] }>>(
        'customer-portal/financial/boletos',
      );
      this.boletos.set(response.data.items ?? []);
    } catch {
      this.boletos.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(status: string): string {
    return ['paid', 'open', 'overdue', 'canceled'].includes(status)
      ? this.i18n.t(`financial.status.${status}`)
      : status;
  }

  formatCurrency(value: number): string {
    return this.i18n.formatCurrency(value);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Date-only values (YYYY-MM-DD) are calendar dates; parsing them as UTC shifts the day.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    const date = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(dateStr);
    return this.i18n.formatDate(date);
  }

  async copyToClipboard(text: string, labelKey: string): Promise<void> {
    const label = this.i18n.t(labelKey);
    try {
      await navigator.clipboard.writeText(text);
      this.snackBar.open(this.i18n.t('financial.copied', { label }), undefined, { duration: 3000 });
    } catch {
      this.snackBar.open(this.i18n.t('financial.copyFailed', { label }), this.i18n.t('common.ok'), {
        duration: 5000,
      });
    }
  }
}
