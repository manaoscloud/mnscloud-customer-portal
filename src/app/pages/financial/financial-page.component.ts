import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Financeiro</span>
          <h1>Faturas e Cobranças</h1>
        </div>
      </header>

      @if (loading()) {
        <div class="empty-state">
          <mat-icon class="spin">sync</mat-icon>
          <p>Carregando faturas...</p>
        </div>
      } @else if (boletos().length === 0) {
        <div class="empty-state">
          <mat-icon>check_circle</mat-icon>
          <h2>Nenhuma fatura em aberto</h2>
          <p>Você não possui cobranças pendentes no momento.</p>
        </div>
      } @else {
        <div class="boletos-grid">
          @for (boleto of boletos(); track boleto.uuid) {
            <article class="boleto-card" [class.is-paid]="boleto.status === 'paid'" [class.is-overdue]="boleto.status === 'overdue'">
              <div class="card-header">
                <div>
                  <span class="boleto-id">#{{ boleto.id }}</span>
                  <h3 class="boleto-title">{{ boleto.title || 'Cobrança' }}</h3>
                </div>
                <span class="status-badge" [class]="'status-' + boleto.status">
                  {{ statusLabel(boleto.status) }}
                </span>
              </div>

              <div class="card-body">
                <div class="info-row">
                  <span class="label">Valor:</span>
                  <strong class="amount">{{ formatCurrency(boleto.amount) }}</strong>
                </div>
                <div class="info-row">
                  <span class="label">Vencimento:</span>
                  <span class="value">{{ formatDate(boleto.dueDate) }}</span>
                </div>
              </div>

              @if (boleto.status !== 'paid' && boleto.status !== 'canceled') {
                <div class="card-actions">
                  @if (boleto.pixCopyPaste) {
                    <button type="button" class="action-btn btn-pix" (click)="copyToClipboard(boleto.pixCopyPaste, 'Pix Copia e Cola')">
                      <mat-icon>qr_code</mat-icon>
                      Copiar Pix
                    </button>
                  }

                  @if (boleto.digitableLine) {
                    <button type="button" class="action-btn btn-boleto" (click)="copyToClipboard(boleto.digitableLine, 'Linha Digitável')">
                      <mat-icon>content_copy</mat-icon>
                      Linha Digitável
                    </button>
                  }

                  @if (boleto.boletoUrl) {
                    <a [href]="boleto.boletoUrl" target="_blank" rel="noopener noreferrer" class="action-btn btn-pdf">
                      <mat-icon>description</mat-icon>
                      PDF Boleto
                    </a>
                  }

                  @if (boleto.invoiceUrl) {
                    <a [href]="boleto.invoiceUrl" target="_blank" rel="noopener noreferrer" class="action-btn btn-card">
                      <mat-icon>credit_card</mat-icon>
                      Pagar com Cartão
                    </a>
                  }
                </div>
              }
            </article>
          }
        </div>
      }

      @if (copiedMessage()) {
        <div class="toast-copied">
          <mat-icon>check</mat-icon>
          {{ copiedMessage() }}
        </div>
      }
    </section>
  `,
  styles: [`
    .page-header {
      margin-bottom: 24px;
    }
    .eyebrow {
      text-transform: uppercase;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: #6366f1;
    }
    h1 {
      margin: 4px 0 0;
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
    }
    .empty-state {
      padding: 48px;
      text-align: center;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #10b981;
        margin-bottom: 12px;
      }
      p { color: #64748b; margin: 4px 0 0; }
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .boletos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }
    .boleto-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: box-shadow 0.2s, transform 0.2s;
      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      }
      &.is-paid {
        border-left: 4px solid #10b981;
      }
      &.is-overdue {
        border-left: 4px solid #ef4444;
      }
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .boleto-id {
      font-size: 0.75rem;
      font-family: monospace;
      color: #94a3b8;
    }
    .boleto-title {
      margin: 2px 0 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #0f172a;
    }
    .status-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      &.status-open {
        background: #fef3c7;
        color: #b45309;
      }
      &.status-paid {
        background: #d1fae5;
        color: #065f46;
      }
      &.status-overdue {
        background: #fee2e2;
        color: #991b1b;
      }
      &.status-canceled {
        background: #f1f5f9;
        color: #64748b;
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
        color: #64748b;
      }
      .amount {
        font-size: 1.25rem;
        font-weight: 700;
        color: #0f172a;
      }
      .value {
        font-size: 0.875rem;
        font-weight: 500;
        color: #334155;
      }
    }
    .card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease-in-out;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      &.btn-pix {
        background: #f0fdf4;
        color: #15803d;
        border-color: #bbf7d0;
        &:hover { background: #dcfce7; }
      }
      &.btn-boleto {
        background: #f8fafc;
        color: #334155;
        border-color: #cbd5e1;
        &:hover { background: #f1f5f9; }
      }
      &.btn-pdf {
        background: #eff6ff;
        color: #1d4ed8;
        border-color: #bfdbfe;
        &:hover { background: #dbeafe; }
      }
      &.btn-card {
        background: #faf5ff;
        color: #7e22ce;
        border-color: #e9d5ff;
        &:hover { background: #f3e8ff; }
      }
    }
    .toast-copied {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      animation: fadeIn 0.2s ease-out;
      z-index: 1000;
      mat-icon { color: #4ade80; }
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class FinancialPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly boletos = signal<CustomerBoleto[]>([]);
  readonly loading = signal<boolean>(true);
  readonly copiedMessage = signal<string | null>(null);

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
    switch (status) {
      case 'paid': return 'Pago';
      case 'open': return 'Em aberto';
      case 'overdue': return 'Vencido';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  }

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard.writeText(text);
    this.copiedMessage.set(`${label} copiado para a área de transferência!`);
    setTimeout(() => this.copiedMessage.set(null), 3000);
  }
}
