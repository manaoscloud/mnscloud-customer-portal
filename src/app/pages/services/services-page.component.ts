import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'mcp-services-page',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Operations</span>
          <h1>Services</h1>
        </div>
      </header>

      <div class="module-grid">
        <article class="module-tile card">
          <span class="icon-badge"><mat-icon>settings_phone</mat-icon></span>
          <h2>PABX</h2>
          <p>Customer-linked accounts, extensions and call resources will be filtered by CustomerCusUUID.</p>
        </article>
        <article class="module-tile card">
          <span class="icon-badge"><mat-icon>language</mat-icon></span>
          <h2>Hosting</h2>
          <p>Hosting, VPS, storage and future services can be added as independent portal modules.</p>
        </article>
      </div>
    </section>
  `,
})
export class ServicesPageComponent {}
