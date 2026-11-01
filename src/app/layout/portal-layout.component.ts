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
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { LanguagePickerComponent } from '../core/i18n/language-picker.component';
import { PortalI18nService } from '../core/i18n/portal-i18n.service';
import { ThemeService } from '../core/theme/theme.service';
import type { CustomerPortalRole } from '../models/session.model';

type NavItem = { path: string; icon: string; label: string };

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'nav.section.overview',
    items: [
      { path: '/dashboard', icon: 'space_dashboard', label: 'nav.dashboard' },
      { path: '/financial', icon: 'receipt_long', label: 'nav.financial' },
      { path: '/ged', icon: 'folder_copy', label: 'nav.ged' },
      { path: '/conversations', icon: 'forum', label: 'nav.conversations' },
      { path: '/crm', icon: 'workspaces', label: 'nav.crm' },
      { path: '/dns', icon: 'shield', label: 'nav.dns' },
      { path: '/logs', icon: 'receipt_long', label: 'nav.logs' },
      { path: '/hr', icon: 'badge', label: 'nav.hr' },
      { path: '/infragis', icon: 'map', label: 'nav.infragis' },
      { path: '/services', icon: 'dns', label: 'nav.services' },
      { path: '/support', icon: 'support_agent', label: 'nav.support' },
    ],
  },
  {
    title: 'nav.section.account',
    items: [
      { path: '/users', icon: 'group', label: 'nav.users' },
      { path: '/profile', icon: 'person', label: 'nav.profile' },
    ],
  },
];

const ROLES: readonly CustomerPortalRole[] = ['CUSTOMER_OWNER', 'CUSTOMER_ADMIN', 'CUSTOMER_USER'];

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
    TranslocoPipe,
    LanguagePickerComponent,
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
            <small>{{ 'app.title' | transloco }}</small>
          </span>
        </div>

        @for (section of sections; track section.title) {
          <div class="nav-section">{{ section.title | transloco }}</div>
          <nav class="nav-list" [attr.aria-label]="section.title | transloco">
            @for (item of section.items; track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" (click)="closeOnMobile(drawer)">
                <mat-icon>{{ item.icon }}</mat-icon>
                <span>{{ item.label | transloco }}</span>
              </a>
            }
          </nav>
        }
      </mat-sidenav>

      <mat-sidenav-content class="portal-main">
        <mat-toolbar class="topbar">
          @if (isMobile()) {
            <button matIconButton type="button" [attr.aria-label]="'nav.open' | transloco" (click)="drawer.toggle()">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="topbar-title">{{ 'app.title' | transloco }}</span>

          <mcp-language-picker />

          <button
            matIconButton
            type="button"
            [matTooltip]="(theme.scheme() === 'dark' ? 'topbar.lightMode' : 'topbar.darkMode') | transloco"
            [attr.aria-label]="(theme.scheme() === 'dark' ? 'topbar.switchToLight' : 'topbar.switchToDark') | transloco"
            (click)="theme.toggle()"
          >
            <mat-icon>{{ theme.scheme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>

          <button class="user-chip" type="button" [matMenuTriggerFor]="userMenu" [attr.aria-label]="'topbar.accountMenu' | transloco">
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
              <span>{{ auth.user()?.email || auth.user()?.username }}</span>
            </div>
            <a mat-menu-item routerLink="/profile">
              <mat-icon>person</mat-icon>
              <span>{{ 'nav.profile' | transloco }}</span>
            </a>
            <button mat-menu-item type="button" (click)="void auth.signOut()">
              <mat-icon>logout</mat-icon>
              <span>{{ 'topbar.signOut' | transloco }}</span>
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
  private readonly i18n = inject(PortalI18nService);
  readonly sections = NAV_SECTIONS;

  readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  readonly displayName = computed(() => {
    const user = this.auth.user();
    this.i18n.language();
    return user?.name || user?.username || user?.email || this.i18n.t('app.customer');
  });

  readonly initials = computed(() => {
    const parts = this.displayName().split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'C';
  });

  readonly roleLabel = computed(() => {
    const role = this.auth.user()?.role;
    this.i18n.language();
    return role ? (ROLES.includes(role) ? this.i18n.t(`role.${role}`) : role) : '';
  });

  closeOnMobile(drawer: MatSidenav): void {
    if (this.isMobile()) void drawer.close();
  }
}
