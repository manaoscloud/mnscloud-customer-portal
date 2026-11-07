import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import { PortalI18nService, type PortalLanguage } from '../../core/i18n/portal-i18n.service';
import type { ApiEnvelope } from '../../models/session.model';

/** A website order of the signed-in customer (GET /customer-portal/orders). */
export type PortalOrder = {
  orderUUID: string;
  id: string | null;
  offerName: string | null;
  kind: string | null;
  currency: string;
  price: number;
  cycle: string | null;
  firstAmount: number;
  trialDays: number;
  status: string;
  chargeStatus: string | null;
  expiresAt: string | null;
  dateCreated: string | null;
};

type OfferText = { name: string; summary?: string; features?: string[] };

/** An offer of the customer's tenant (GET /customer-portal/offers, public columns only). */
export type PortalOffer = {
  slug: string;
  kind: string;
  currency: string;
  price: number;
  setupFee: number;
  cycle: string;
  trialDays: number;
  approvalRequired: boolean;
  texts: Partial<Record<PortalLanguage, OfferText>>;
};

/** Text of the offer in the portal language, then pt-BR, English and Spanish. */
export function offerText(offer: PortalOffer, language: PortalLanguage): OfferText {
  return (
    offer.texts[language] ??
    offer.texts['pt-BR'] ??
    offer.texts['en-US'] ??
    offer.texts['es-ES'] ?? { name: offer.slug }
  );
}

/** Orders still open for the same offer: contracting again would duplicate them. */
const OPEN_STATUSES = new Set(['awaiting_approval', 'awaiting_payment', 'paid', 'provisioning']);

@Component({
  selector: 'mcp-services-page',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe, CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'services.eyebrow' | transloco }}</span>
          <h1>{{ 'services.title' | transloco }}</h1>
        </div>
      </header>

      @if (orders().length) {
        <h2 class="section-title">{{ 'services.ordersTitle' | transloco }}</h2>
        <div class="module-grid">
          @for (order of orders(); track order.orderUUID) {
            <article class="module-tile card">
              <span class="icon-badge"
                ><mat-icon>{{ order.kind === 'vps' ? 'dns' : 'language' }}</mat-icon></span
              >
              <h2>{{ order.offerName }}</h2>
              <p>
                {{ order.price | currency: order.currency }}
                {{ 'services.cycle.' + order.cycle | transloco }}
              </p>
              <p>
                <strong>{{ 'services.orderStatus.' + order.status | transloco }}</strong>
                @if (order.status === 'awaiting_payment' && order.firstAmount > 0) {
                  · {{ 'services.payIn' | transloco }} {{ 'nav.financial' | transloco }}
                }
              </p>
              @if (order.trialDays > 0) {
                <p>{{ order.trialDays }} {{ 'services.trialDays' | transloco }}</p>
              }
              <p class="muted">#{{ order.id }} · {{ order.dateCreated | date: 'short' }}</p>
            </article>
          }
        </div>
      }

      @if (offers().length) {
        <h2 class="section-title">{{ 'services.contractTitle' | transloco }}</h2>
        <div class="module-grid">
          @for (offer of offers(); track offer.slug) {
            <article class="module-tile card">
              <span class="icon-badge"
                ><mat-icon>{{ offer.kind === 'vps' ? 'dns' : 'language' }}</mat-icon></span
              >
              <h2>{{ text(offer).name }}</h2>
              @if (text(offer).summary) {
                <p>{{ text(offer).summary }}</p>
              }
              @if (text(offer).features?.length) {
                <ul class="features">
                  @for (feature of text(offer).features; track $index) {
                    <li>{{ feature }}</li>
                  }
                </ul>
              }
              <p>
                <strong>{{ offer.price | currency: offer.currency }}</strong>
                {{ 'services.cycle.' + offer.cycle | transloco }}
              </p>
              @if (offer.setupFee > 0) {
                <p>
                  {{ 'services.setupFee' | transloco }}
                  {{ offer.setupFee | currency: offer.currency }}
                </p>
              }
              @if (offer.trialDays > 0) {
                <p>{{ offer.trialDays }} {{ 'services.trialDays' | transloco }}</p>
              }
              @if (offer.approvalRequired) {
                <p class="muted">{{ 'services.approvalRequired' | transloco }}</p>
              }
              @if (canOrder()) {
                <button
                  mat-flat-button
                  type="button"
                  [disabled]="busy() === offer.slug || hasOpenOrder(offer)"
                  (click)="contract(offer)"
                >
                  {{
                    (hasOpenOrder(offer) ? 'services.alreadyOrdered' : 'services.contract')
                      | transloco
                  }}
                </button>
              }
            </article>
          }
        </div>
        @if (!canOrder()) {
          <p class="muted">{{ 'services.contractOwnerOnly' | transloco }}</p>
        }
      }

      <div class="module-grid">
        <article class="module-tile card">
          <span class="icon-badge"><mat-icon>settings_phone</mat-icon></span>
          <h2>{{ 'services.pabxTitle' | transloco }}</h2>
          <p>{{ 'services.pabxText' | transloco }}</p>
        </article>
        <article class="module-tile card">
          <span class="icon-badge"><mat-icon>language</mat-icon></span>
          <h2>{{ 'services.hostingTitle' | transloco }}</h2>
          <p>{{ 'services.hostingText' | transloco }}</p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .section-title {
      font-size: 1.05rem;
      margin: 8px 0 12px;
    }
    .muted {
      opacity: 0.7;
      font-size: 0.85rem;
    }
    .features {
      margin: 0 0 8px;
      padding-left: 18px;
    }
  `,
})
export class ServicesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(PortalI18nService);
  private readonly snackBar = inject(MatSnackBar);
  readonly orders = signal<PortalOrder[]>([]);
  readonly offers = signal<PortalOffer[]>([]);
  readonly canOrder = signal<boolean>(false);
  /** Slug of the offer being contracted (one request at a time). */
  readonly busy = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadOrders(), this.loadOffers()]);
  }

  text(offer: PortalOffer): OfferText {
    return offerText(offer, this.i18n.language());
  }

  hasOpenOrder(offer: PortalOffer): boolean {
    const name = this.text(offer).name;
    return this.orders().some(
      (order) => order.offerName === name && OPEN_STATUSES.has(order.status),
    );
  }

  async contract(offer: PortalOffer): Promise<void> {
    const name = this.text(offer).name;
    if (!window.confirm(this.i18n.t('services.contractConfirm', { name }))) return;
    this.busy.set(offer.slug);
    try {
      await this.api.post('customer-portal/orders', {
        offer: offer.slug,
        idempotencyKey: crypto.randomUUID(),
      });
      this.snackBar.open(
        this.i18n.t(
          offer.approvalRequired ? 'services.orderPlacedApproval' : 'services.orderPlaced',
        ),
        this.i18n.t('common.ok'),
        { duration: 8000 },
      );
      await this.loadOrders();
    } catch {
      this.snackBar.open(this.i18n.t('services.orderFailed'), this.i18n.t('common.ok'), {
        duration: 8000,
      });
    } finally {
      this.busy.set(null);
    }
  }

  private async loadOrders(): Promise<void> {
    try {
      const response =
        await this.api.get<ApiEnvelope<{ items: PortalOrder[] }>>('customer-portal/orders');
      this.orders.set(response.data.items ?? []);
    } catch {
      this.orders.set([]);
    }
  }

  private async loadOffers(): Promise<void> {
    try {
      const response =
        await this.api.get<ApiEnvelope<{ items: PortalOffer[]; canOrder: boolean }>>(
          'customer-portal/offers',
        );
      this.offers.set(response.data.items ?? []);
      this.canOrder.set(response.data.canOrder === true);
    } catch {
      this.offers.set([]);
      this.canOrder.set(false);
    }
  }
}
