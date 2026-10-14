import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/theme/theme.service';
import type { CustomerPortalRole } from '../models/session.model';

type NavItem = { path: string; icon: string; label: string };

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { path: '/dashboard', icon: 'space_dashboard', label: 'Dashboard' },
      { path: '/financial', icon: 'receipt_long', label: 'Financial' },
      { path: '/services', icon: 'dns', label: 'Services' },
      { path: '/support', icon: 'support_agent', label: 'Support' },
    ],
  },
  {
    title: 'Account',
    items: [
      { path: '/users', icon: 'group', label: 'Users' },
      { path: '/profile', icon: 'person', label: 'Profile' },
    ],
  },
];

const ROLE_LABELS: Record<CustomerPortalRole, string> = {
  CUSTOMER_OWNER: 'Owner',
  CUSTOMER_ADMIN: 'Administrator',
  CUSTOMER_USER: 'User',
};

@Component({
  selector: 'mcp-portal-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <mat-sidenav-container class="portal-shell">
      <mat-sidenav
        #drawer
        class="portal-nav"
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="!isMobile()"
      >
        <div class="brand">
          <span class="brand-mark">M</span>
          <span>
            MNSCloud
            <small>Customer Portal</small>
          </span>
        </div>

        @for (section of sections; track section.title) {
          <div class="nav-section">{{ section.title }}</div>
          <nav class="nav-list" [attr.aria-label]="section.title">
            @for (item of section.items; track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" (click)="closeOnMobile(drawer)">
                <mat-icon>{{ item.icon }}</mat-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        }
      </mat-sidenav>

      <mat-sidenav-content class="portal-main">
        <mat-toolbar class="topbar">
          @if (isMobile()) {
            <button matIconButton type="button" aria-label="Open navigation" (click)="drawer.toggle()">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="topbar-title">Customer Portal</span>

          <button
            matIconButton
            type="button"
            [matTooltip]="theme.scheme() === 'dark' ? 'Light mode' : 'Dark mode'"
            [attr.aria-label]="theme.scheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            (click)="theme.toggle()"
          >
            <mat-icon>{{ theme.scheme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>

          <button class="user-chip" type="button" [matMenuTriggerFor]="userMenu" aria-label="Account menu">
            <span class="avatar">{{ initials() }}</span>
            <span class="user-chip-text">
              <strong>{{ displayName() }}</strong>
              <span>{{ roleLabel() }}</span>
            </span>
            <mat-icon>expand_more</mat-icon>
          </button>

          <mat-menu #userMenu="matMenu" xPosition="before">
            <div class="user-menu-header">
              <strong>{{ displayName() }}</strong>
              <span>{{ auth.user()?.email }}</span>
            </div>
            <a mat-menu-item routerLink="/profile">
              <mat-icon>person</mat-icon>
              <span>Profile</span>
            </a>
            <button mat-menu-item type="button" (click)="void auth.signOut()">
              <mat-icon>logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
})
export class PortalLayoutComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly sections = NAV_SECTIONS;

  readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  readonly displayName = computed(() => {
    const user = this.auth.user();
    return user?.name || user?.username || user?.email || 'Customer';
  });

  readonly initials = computed(() => {
    const parts = this.displayName().split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'C';
  });

  readonly roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    return role ? ROLE_LABELS[role] ?? role : '';
  });

  closeOnMobile(drawer: MatSidenav): void {
    if (this.isMobile()) void drawer.close();
  }
}
