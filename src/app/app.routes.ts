import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { GuestLayoutComponent } from './layout/guest-layout.component';
import { PortalLayoutComponent } from './layout/portal-layout.component';
import { LoginPageComponent } from './pages/login-page.component';
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
    path: '',
    component: PortalLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'financial', component: FinancialPageComponent },
      { path: 'services', component: ServicesPageComponent },
      { path: 'support', component: SupportPageComponent },
      { path: 'profile', component: ProfilePageComponent },
      { path: 'users', component: UsersPageComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
