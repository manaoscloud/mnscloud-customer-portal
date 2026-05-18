import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'mcp-financial-page',
  imports: [MatIconModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Billing</span>
          <h1>Financial</h1>
        </div>
      </header>

      <div class="module-grid">
        <article class="module-tile">
          <mat-icon>receipt</mat-icon>
          <h2>Invoices</h2>
          <p>Invoice listing and document downloads will be exposed through customer-scoped API endpoints.</p>
        </article>
        <article class="module-tile">
          <mat-icon>payments</mat-icon>
          <h2>Boletos</h2>
          <p>Payment actions will remain API-owned and return only public, scoped payment data.</p>
        </article>
      </div>
    </section>
  `,
})
export class FinancialPageComponent {}
