import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { GuestLayoutComponent } from './layout/guest-layout.component';
import { PortalLayoutComponent } from './layout/portal-layout.component';
import { LoginPageComponent } from './pages/login-page.component';
import { ConnectionTestPageComponent } from './pages/connection-test/connection-test-page.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { FinancialPageComponent } from './pages/financial/financial-page.component';
import { ServicesPageComponent } from './pages/services/services-page.component';
import { SupportPageComponent } from './pages/support/support-page.component';
import { ProfilePageComponent } from './pages/profile/profile-page.component';
import { UsersPageComponent } from './pages/users/users-page.component';

export const routes: Routes = [
  {
    path: 'auth',
    component: GuestLayoutComponent,
    children: [{ path: 'login', component: LoginPageComponent }],
  },
  {
    // Public: the subscriber opens it without signing in when the connection fails.
    path: 'teste',
    component: GuestLayoutComponent,
    children: [{ path: '', component: ConnectionTestPageComponent }],
  },
  {
    path: '',
    component: PortalLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'ged', loadComponent: () => import('./pages/ged/ged-page.component').then((m) => m.GedPageComponent) },
      {
        path: 'conversations',
        loadComponent: () =>
          import('./pages/conversations/conversations-page.component').then((m) => m.ConversationsPageComponent),
      },
      {
        path: 'crm',
        loadComponent: () => import('./pages/crm/crm-page.component').then((m) => m.CrmPageComponent),
      },
      {
        path: 'dns',
        loadComponent: () => import('./pages/dns/dns-page.component').then((m) => m.DnsPageComponent),
      },
      {
        path: 'hr',
        loadComponent: () => import('./pages/hr/hr-page.component').then((m) => m.HrPageComponent),
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs-page.component').then((m) => m.LogsPageComponent),
      },
      { path: 'financial', component: FinancialPageComponent },
      { path: 'services', component: ServicesPageComponent },
      { path: 'support', component: SupportPageComponent },
      { path: 'profile', component: ProfilePageComponent },
      { path: 'users', component: UsersPageComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
