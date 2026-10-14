import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'mcp-support-page',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Help desk</span>
          <h1>Support</h1>
        </div>
      </header>

      <div class="module-grid">
        <article class="module-tile card">
          <span class="icon-badge"><mat-icon>confirmation_number</mat-icon></span>
          <h2>Tickets</h2>
          <p>Ticket creation and follow-up will use the customer portal permission catalog.</p>
        </article>
      </div>
    </section>
  `,
})
export class SupportPageComponent {}
