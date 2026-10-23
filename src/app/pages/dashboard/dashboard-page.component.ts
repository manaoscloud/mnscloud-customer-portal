import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

type DashboardSummary = {
  activeServices?: number;
  openFinancialItems?: number;
  openTickets?: number;
  customerStatus?: number;
};

@Component({
  selector: 'mcp-dashboard-page',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'dashboard.eyebrow' | transloco }}</span>
          <h1>{{ 'dashboard.title' | transloco }}</h1>
        </div>
      </header>

      <div class="metric-grid">
        <article class="metric card">
          <span class="icon-badge"><mat-icon>dns</mat-icon></span>
          <span>{{ 'dashboard.activeServices' | transloco }}</span>
          <strong>{{ summary()?.activeServices ?? 0 }}</strong>
        </article>
        <article class="metric card">
          <span class="icon-badge"><mat-icon>receipt_long</mat-icon></span>
          <span>{{ 'dashboard.financialItems' | transloco }}</span>
          <strong>{{ summary()?.openFinancialItems ?? 0 }}</strong>
        </article>
        <article class="metric card">
          <span class="icon-badge"><mat-icon>support_agent</mat-icon></span>
          <span>{{ 'dashboard.openTickets' | transloco }}</span>
          <strong>{{ summary()?.openTickets ?? 0 }}</strong>
        </article>
      </div>
    </section>
  `,
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly summary = signal<DashboardSummary | null>(null);

  async ngOnInit(): Promise<void> {
    const response = await this.api.get<ApiEnvelope<{ summary: DashboardSummary }>>(
      'customer-portal/dashboard/summary',
    );
    this.summary.set(response.data.summary);
  }
}
