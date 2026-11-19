import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type PosTerminal = {
  terminalUUID: string;
  terminalName: string;
  accountUUID: string;
  accountName: string;
  operatorName: string;
  cashOpen: boolean;
};
export type PosShop = { accountUUID: string; accountName: string; terminals: PosTerminal[] };

/** Terminals grouped by shop, keeping the order the API returned. */
export function groupByShop(items: PosTerminal[]): PosShop[] {
  const shops = new Map<string, PosShop>();
  for (const item of items) {
    const shop = shops.get(item.accountUUID) ?? {
      accountUUID: item.accountUUID,
      accountName: item.accountName,
      terminals: [],
    };
    shop.terminals.push(item);
    shops.set(item.accountUUID, shop);
  }
  return [...shops.values()];
}

/** POS terminals the logged-in Portal user may open; the web POS opens with a single-use code. */
@Component({
  selector: 'mcp-pos-page',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'pos.title' | transloco }}</h1>
          <p>{{ 'pos.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'pos.error' | transloco }}</p>
      }
      @if (openError()) {
        <p class="card" role="alert">{{ 'pos.openError' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'pos.loading' | transloco }}</p>
      } @else if (!error() && shops().length === 0) {
        <p class="card">{{ 'pos.empty' | transloco }}</p>
      }

      @for (shop of shops(); track shop.accountUUID) {
        <article class="card shop">
          <h2>{{ shop.accountName }}</h2>
          <ul>
            @for (terminal of shop.terminals; track terminal.terminalUUID) {
              <li class="terminal">
                <div class="info">
                  <strong>{{ terminal.terminalName }}</strong>
                  <span class="operator">{{
                    'pos.operator' | transloco: { name: terminal.operatorName }
                  }}</span>
                  @if (terminal.cashOpen) {
                    <span class="chip">{{ 'pos.cashOpen' | transloco }}</span>
                  }
                </div>
                <button
                  matButton="filled"
                  type="button"
                  [disabled]="opening() !== null"
                  (click)="open(terminal)"
                >
                  <mat-icon>point_of_sale</mat-icon>{{ 'pos.open' | transloco }}
                </button>
              </li>
            }
          </ul>
        </article>
      }
      @if (shops().length > 0) {
        <p class="hint">{{ 'pos.hint' | transloco }}</p>
      }
    </section>
  `,
  styles: [
    `
      .shop {
        padding: 16px 20px;
        margin-bottom: 16px;
      }
      .shop h2 {
        font-size: 1.05rem;
        margin: 0 0 8px;
        overflow-wrap: anywhere;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .terminal {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid var(--border-color, #eee);
      }
      .info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        align-items: flex-start;
      }
      .info strong {
        overflow-wrap: anywhere;
      }
      .operator {
        font-size: 0.85rem;
        color: var(--text-secondary, #666);
      }
      .chip {
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.8rem;
        background: var(--tenant-primary-color, var(--primary, #0b57d0));
        color: var(--on-primary, #fff);
      }
      button {
        --mat-button-filled-container-color: var(--tenant-primary-color, var(--primary, #0b57d0));
      }
      .hint {
        margin-top: 8px;
        font-size: 0.85rem;
        color: var(--text-secondary, #666);
      }
      @media (max-width: 600px) {
        .terminal button {
          width: 100%;
        }
      }
    `,
  ],
})
export class PosPageComponent {
  private readonly api = inject(ApiService);
  readonly terminals = signal<PosTerminal[]>([]);
  readonly shops = computed(() => groupByShop(this.terminals()));
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly openError = signal(false);
  readonly opening = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: PosTerminal[] }>>(
        'customer-portal/pos/terminals',
      );
      this.terminals.set(response.data?.items ?? []);
    } catch (error) {
      this.terminals.set([]);
      // No access is an empty state, not an error.
      if (!(
        error instanceof ApiError &&
        error.status === 404 &&
        error.code === 'POS_PORTAL_UNAVAILABLE'
      )) {
        this.error.set(true);
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Opens the POS in a new tab; the single-use code travels only in the URL fragment. */
  async open(terminal: PosTerminal) {
    if (this.opening() !== null) return;
    this.opening.set(terminal.terminalUUID);
    this.openError.set(false);
    // Opened on the click, before the request, so popup blockers allow it.
    const popup = window.open('', '_blank');
    try {
      const response = await this.api.post<ApiEnvelope<{ code: string; path: string }>>(
        'customer-portal/pos/handoffs',
        { terminalUUID: terminal.terminalUUID },
      );
      const code = response.data?.code;
      if (!code) throw new Error('empty');
      const path = response.data?.path || '/pos/';
      if (!popup) throw new Error('blocked');
      popup.opener = null;
      popup.location.href = `${path}#handoff=${encodeURIComponent(code)}`;
    } catch {
      popup?.close();
      this.openError.set(true);
    } finally {
      this.opening.set(null);
    }
  }
}
