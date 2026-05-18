import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'mcp-users-page',
  imports: [MatIconModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Access</span>
          <h1>Users</h1>
        </div>
      </header>

      <div class="module-grid">
        <article class="module-tile">
          <mat-icon>admin_panel_settings</mat-icon>
          <h2>Portal access</h2>
          <p>User management will be available to customer owners through scoped access rules.</p>
        </article>
      </div>
    </section>
  `,
})
export class UsersPageComponent {}
