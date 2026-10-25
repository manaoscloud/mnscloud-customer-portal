import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
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

@Component({
  selector: 'mcp-services-page',
  imports: [MatIconModule, TranslocoPipe, CurrencyPipe, DatePipe],
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
  `,
})
export class ServicesPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly orders = signal<PortalOrder[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const response =
        await this.api.get<ApiEnvelope<{ items: PortalOrder[] }>>('customer-portal/orders');
      this.orders.set(response.data.items ?? []);
    } catch {
      this.orders.set([]);
    }
  }
}
