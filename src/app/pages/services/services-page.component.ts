import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'mcp-services-page',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'services.eyebrow' | transloco }}</span>
          <h1>{{ 'services.title' | transloco }}</h1>
        </div>
      </header>

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
})
export class ServicesPageComponent {}
