import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'mcp-portal-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule],
  template: `
    <div class="portal-shell">
      <aside class="portal-nav">
        <div class="brand">
          <span class="brand-mark">M</span>
          <span>Customer Portal</span>
        </div>

        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            <span>Dashboard</span>
          </a>
          <a routerLink="/financial" routerLinkActive="active">
            <mat-icon>receipt_long</mat-icon>
            <span>Financial</span>
          </a>
          <a routerLink="/services" routerLinkActive="active">
            <mat-icon>dns</mat-icon>
            <span>Services</span>
          </a>
          <a routerLink="/support" routerLinkActive="active">
            <mat-icon>support_agent</mat-icon>
            <span>Support</span>
          </a>
          <a routerLink="/users" routerLinkActive="active">
            <mat-icon>group</mat-icon>
            <span>Users</span>
          </a>
          <a routerLink="/profile" routerLinkActive="active">
            <mat-icon>person</mat-icon>
            <span>Profile</span>
          </a>
        </nav>
      </aside>

      <section class="portal-main">
        <header class="topbar">
          <div>
            <strong>{{ auth.user()?.name || auth.user()?.email }}</strong>
            <span>{{ auth.user()?.role }}</span>
          </div>
          <button mat-stroked-button type="button" (click)="auth.signOut()">
            <mat-icon>logout</mat-icon>
            Sign out
          </button>
        </header>

        <router-outlet />
      </section>
    </div>
  `,
})
export class PortalLayoutComponent {
  readonly auth = inject(AuthService);
}
