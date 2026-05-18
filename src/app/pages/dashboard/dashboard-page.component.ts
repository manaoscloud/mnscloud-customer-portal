import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [MatIconModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Overview</span>
          <h1>Dashboard</h1>
        </div>
      </header>

      <div class="metric-grid">
        <article class="metric">
          <mat-icon>dns</mat-icon>
          <span>Active services</span>
          <strong>{{ summary()?.activeServices ?? 0 }}</strong>
        </article>
        <article class="metric">
          <mat-icon>receipt_long</mat-icon>
          <span>Financial items</span>
          <strong>{{ summary()?.openFinancialItems ?? 0 }}</strong>
        </article>
        <article class="metric">
          <mat-icon>support_agent</mat-icon>
          <span>Open tickets</span>
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
