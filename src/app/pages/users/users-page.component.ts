import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'mcp-users-page',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'users.eyebrow' | transloco }}</span>
          <h1>{{ 'users.title' | transloco }}</h1>
        </div>
      </header>

      <div class="module-grid">
        <article class="module-tile card">
          <span class="icon-badge"><mat-icon>admin_panel_settings</mat-icon></span>
          <h2>{{ 'users.accessTitle' | transloco }}</h2>
          <p>{{ 'users.accessText' | transloco }}</p>
        </article>
      </div>
    </section>
  `,
})
export class UsersPageComponent {}
