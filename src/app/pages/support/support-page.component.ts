import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'mcp-support-page',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'support.eyebrow' | transloco }}</span>
          <h1>{{ 'support.title' | transloco }}</h1>
        </div>
      </header>

      <div class="module-grid">
        <article class="module-tile card">
          <span class="icon-badge"><mat-icon>confirmation_number</mat-icon></span>
          <h2>{{ 'support.ticketsTitle' | transloco }}</h2>
          <p>{{ 'support.ticketsText' | transloco }}</p>
        </article>
      </div>
    </section>
  `,
})
export class SupportPageComponent {}
