import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import { HrRequestsComponent } from './hr-requests.component';

export type HrAccount = {
  HraUUID: string;
  HraName: string;
  WorkspaceName: string;
  EmployeesCount: number;
  Dashboard: number;
  Employees: number;
  Schedules: number;
  Timesheets: number;
  Requests: number;
  PendingRequests: number;
};
type Dashboard = Record<string, number | string>;
type Employee = {
  EmployeeUUID: string;
  Name: string;
  CompanyName: string | null;
  DepartmentName: string | null;
  PositionName: string | null;
  TimeClockStatus: string | null;
};
type ScheduleDay = { position: number; start: string | null; breakStart: string | null; breakEnd: string | null; end: string | null };
type Schedule = {
  HwsUUID: string;
  HwsName: string;
  HwsKind: 'weekly' | 'cycle';
  AssignedEmployees: number;
  Days: ScheduleDay[] | null;
};
type Day = {
  Date: string;
  DayKind: string;
  HolidayName: string | null;
  WorkScheduleName: string | null;
  ExpectedMinutes: number;
  WorkedMinutes: number;
  BalanceMinutes: number;
  LateMinutes: number;
  OvertimeMinutes: number;
  AbsenceMinutes: number;
  PunchCount: number;
  Flags: string | null;
};
export type HrTab = 'dashboard' | 'employees' | 'schedules' | 'timesheets' | 'requests';

const TABS: readonly [HrTab, keyof HrAccount, string][] = [
  ['dashboard', 'Dashboard', 'space_dashboard'],
  ['employees', 'Employees', 'badge'],
  ['schedules', 'Schedules', 'calendar_view_week'],
  ['timesheets', 'Timesheets', 'event_note'],
  ['requests', 'Requests', 'pending_actions'],
];
const PAGE = 50;
const METRICS = ['activeEmployees', 'scheduledToday', 'presentToday', 'workingNow', 'lateNow', 'openIssues30d'];
const DAY_KINDS = ['work', 'off', 'holiday', 'no_schedule'];
const FLAGS = [
  'absence', 'missing_punch', 'late', 'early_leave', 'short_break', 'rest_violation',
  'overtime_limit', 'worked_day_off', 'flagged_punch', 'no_schedule',
];

/** Minutes as h:mm, with the sign of a balance. */
export function hours(minutes: number, signed = false): string {
  const value = Math.abs(Math.round(minutes || 0));
  const text = `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  return signed && minutes < 0 ? `-${text}` : signed && minutes > 0 ? `+${text}` : text;
}

/** First and last day (YYYY-MM-DD) of a YYYY-MM month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Read-only HR of the accounts the provider published to this customer, by granted operation. */
@Component({
  selector: 'mcp-hr-page',
  imports: [FormsModule, HrRequestsComponent, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'hr.title' | transloco }}</h1>
          <p>{{ 'hr.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'hr.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'hr.loading' | transloco }}</p>
      } @else if (!error() && accounts().length === 0) {
        <p class="card">{{ 'hr.empty' | transloco }}</p>
      }

      @if (accounts().length > 1) {
        <mat-form-field class="account-select">
          <mat-label>{{ 'hr.account' | transloco }}</mat-label>
          <mat-select [value]="account()?.HraUUID" (valueChange)="selectAccount($event)">
            @for (item of accounts(); track item.HraUUID) {
              <mat-option [value]="item.HraUUID">{{ item.HraName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      } @else if (account()) {
        <p class="account-name">{{ account()!.HraName }}</p>
      }

      @if (account()) {
        <nav class="tabs" [attr.aria-label]="'hr.sections' | transloco">
          @for (item of tabs(); track item[0]) {
            <button
              matButton
              type="button"
              [class.active]="tab() === item[0]"
              [attr.aria-pressed]="tab() === item[0]"
              (click)="openTab(item[0])"
            >
              <mat-icon>{{ item[2] }}</mat-icon>{{ 'hr.tabs.' + item[0] | transloco }}
              @if (item[0] === 'requests' && account()!.PendingRequests > 0) {
                <span class="count" [attr.aria-label]="'hr.requests.pendingCount' | transloco: { count: account()!.PendingRequests }">{{ account()!.PendingRequests }}</span>
              }
            </button>
          }
        </nav>

        @if (busy()) {
          <p role="status">{{ 'hr.loading' | transloco }}</p>
        } @else {
          @switch (tab()) {
            @case ('dashboard') {
              @if (dashboard(); as data) {
                <div class="metrics">
                  @for (metric of metrics; track metric) {
                    <article class="card metric">
                      <span class="metric-value">{{ data[metric] ?? 0 }}</span>
                      <span>{{ 'hr.metrics.' + metric | transloco }}</span>
                    </article>
                  }
                  <article class="card metric">
                    <span class="metric-value">{{ hours(+data['overtimeMonthMinutes']) }}</span>
                    <span>{{ 'hr.metrics.overtimeMonth' | transloco }}</span>
                  </article>
                  <article class="card metric">
                    <span class="metric-value">{{ hours(+data['absenceMonthMinutes']) }}</span>
                    <span>{{ 'hr.metrics.absenceMonth' | transloco }}</span>
                  </article>
                </div>
              }
            }
            @case ('employees') {
              <form class="toolbar" (ngSubmit)="loadEmployees(0)">
                <mat-form-field>
                  <mat-label>{{ 'hr.search' | transloco }}</mat-label>
                  <input matInput name="search" [(ngModel)]="search" maxlength="200" />
                </mat-form-field>
                <button matButton="filled" type="submit">{{ 'hr.search' | transloco }}</button>
              </form>
              @if (employees().length === 0) {
                <p class="card">{{ 'hr.emptyEmployees' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'hr.employee' | transloco }}</th>
                        <th scope="col">{{ 'hr.company' | transloco }}</th>
                        <th scope="col">{{ 'hr.department' | transloco }}</th>
                        <th scope="col">{{ 'hr.position' | transloco }}</th>
                        <th scope="col">{{ 'hr.timeClock' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of employees(); track item.EmployeeUUID) {
                        <tr>
                          <td>{{ item.Name }}</td>
                          <td>{{ item.CompanyName ?? '—' }}</td>
                          <td>{{ item.DepartmentName ?? '—' }}</td>
                          <td>{{ item.PositionName ?? '—' }}</td>
                          <td>{{ (item.TimeClockStatus === 'active' ? 'hr.clockActive' : 'hr.clockNone') | transloco }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <nav class="pagination" [attr.aria-label]="'hr.pagination' | transloco">
                  <button matButton type="button" [disabled]="offset() === 0" (click)="loadEmployees(offset() - page)">
                    {{ 'hr.previous' | transloco }}
                  </button>
                  <button matButton type="button" [disabled]="offset() + page >= total()" (click)="loadEmployees(offset() + page)">
                    {{ 'hr.next' | transloco }}
                  </button>
                </nav>
              }
            }
            @case ('schedules') {
              @if (schedules().length === 0) {
                <p class="card">{{ 'hr.emptySchedules' | transloco }}</p>
              }
              <div class="schedules">
                @for (item of schedules(); track item.HwsUUID) {
                  <article class="card schedule">
                    <h2>{{ item.HwsName }}</h2>
                    <p>{{ 'hr.assigned' | transloco: { count: item.AssignedEmployees } }}</p>
                    <div class="table-wrap">
                      <table>
                        <tbody>
                          @for (day of item.Days ?? []; track day.position) {
                            <tr>
                              <th scope="row">
                                {{ item.HwsKind === 'weekly' ? ('hr.weekdays.' + day.position | transloco) : ('hr.cycleDay' | transloco: { n: day.position }) }}
                              </th>
                              <td>
                                @if (day.start) {
                                  {{ day.start }}–{{ day.end }}
                                  @if (day.breakStart) {
                                    · {{ 'hr.break' | transloco }} {{ day.breakStart }}–{{ day.breakEnd }}
                                  }
                                } @else {
                                  {{ 'hr.dayOff' | transloco }}
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </article>
                }
              </div>
            }
            @case ('requests') {
              <mcp-hr-requests [account]="account()!.HraUUID" (changed)="refreshCounts()" />
            }
            @case ('timesheets') {
              <div class="toolbar">
                <mat-form-field>
                  <mat-label>{{ 'hr.employee' | transloco }}</mat-label>
                  <mat-select [value]="employee()" (valueChange)="employee.set($event); loadDays()">
                    @for (item of people(); track item.EmployeeUUID) {
                      <mat-option [value]="item.EmployeeUUID">{{ item.Name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'hr.month' | transloco }}</mat-label>
                  <input matInput type="month" [value]="month()" (change)="setMonth($event)" />
                </mat-form-field>
              </div>
              @if (!employee()) {
                <p class="card">{{ 'hr.pickEmployee' | transloco }}</p>
              } @else if (days().length === 0) {
                <p class="card">{{ 'hr.emptyDays' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'hr.date' | transloco }}</th>
                        <th scope="col">{{ 'hr.day' | transloco }}</th>
                        <th scope="col">{{ 'hr.expected' | transloco }}</th>
                        <th scope="col">{{ 'hr.worked' | transloco }}</th>
                        <th scope="col">{{ 'hr.balance' | transloco }}</th>
                        <th scope="col">{{ 'hr.punches' | transloco }}</th>
                        <th scope="col">{{ 'hr.issues' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (day of days(); track day.Date) {
                        <tr>
                          <td>{{ day.Date }}</td>
                          <td>{{ day.HolidayName ?? ('hr.dayKinds.' + dayKind(day.DayKind) | transloco) }}</td>
                          <td>{{ hours(day.ExpectedMinutes) }}</td>
                          <td>{{ hours(day.WorkedMinutes) }}</td>
                          <td [class.negative]="day.BalanceMinutes < 0">{{ hours(day.BalanceMinutes, true) }}</td>
                          <td>{{ day.PunchCount }}</td>
                          <td>
                            @for (flag of flagsOf(day); track flag) {
                              <span class="badge">{{ 'hr.flags.' + flag | transloco }}</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <p class="hint">{{ 'hr.timesheetHint' | transloco }}</p>
              }
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .account-select { width: min(100%, 420px); }
    .account-name { font-weight: 600; margin: 0 0 12px; }
    .tabs, .toolbar, .pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
    .toolbar mat-form-field { flex: 1 1 200px; min-width: 0; }
    .tabs button.active { background: var(--surface-container, rgba(0, 0, 0, 0.06)); font-weight: 600; }
    .pagination { justify-content: flex-end; }
    .count { margin-inline-start: 6px; min-width: 20px; padding: 0 6px; border-radius: 999px; font-size: 0.75rem; line-height: 20px; text-align: center; background: var(--primary, #0b57d0); color: var(--on-primary, #fff); }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .metric { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
    .metric-value { font-size: 1.6rem; font-weight: 600; }
    .schedules { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
    .schedule { padding: 16px 20px; min-width: 0; }
    .schedule h2 { font-size: 1.05rem; margin: 0 0 4px; overflow-wrap: anywhere; }
    .table-wrap { overflow-x: auto; }
    .table-wrap.card { padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: start; border-bottom: 1px solid var(--border-color, #eee); white-space: nowrap; }
    .negative { color: var(--error, #b3261e); }
    .badge { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 8px; border-radius: 999px; font-size: 0.8rem; background: var(--surface-container, rgba(0, 0, 0, 0.05)); }
    .hint { margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary, #666); }
  `],
})
export class HrPageComponent {
  private readonly api = inject(ApiService);
  readonly page = PAGE;
  readonly metrics = METRICS;
  readonly hours = hours;
  readonly accounts = signal<HrAccount[]>([]);
  readonly account = signal<HrAccount | null>(null);
  readonly tab = signal<HrTab>('dashboard');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly employees = signal<Employee[]>([]);
  readonly people = signal<Employee[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly schedules = signal<Schedule[]>([]);
  readonly employee = signal<string | null>(null);
  readonly month = signal(new Date().toISOString().slice(0, 7));
  readonly days = signal<Day[]>([]);
  readonly tabs = computed(() => {
    const account = this.account();
    return account ? TABS.filter(([, flag]) => Number(account[flag]) === 1) : [];
  });
  search = '';

  constructor() {
    void this.load();
  }

  private base(): string {
    return `customer-portal/hr/accounts/${encodeURIComponent(this.account()!.HraUUID)}`;
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: HrAccount[] }>>('customer-portal/hr/accounts');
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length > 0) await this.selectAccount(items[0].HraUUID);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async selectAccount(uuid: string) {
    this.account.set(this.accounts().find((item) => item.HraUUID === uuid) ?? null);
    this.employee.set(null);
    this.people.set([]);
    this.days.set([]);
    const first = this.tabs()[0];
    if (first) await this.openTab(first[0]);
  }

  async openTab(tab: HrTab) {
    this.tab.set(tab);
    this.busy.set(true);
    this.error.set(false);
    try {
      if (tab === 'dashboard') {
        this.dashboard.set((await this.api.get<ApiEnvelope<Dashboard>>(`${this.base()}/dashboard`)).data ?? null);
      } else if (tab === 'employees') {
        await this.loadEmployees(0);
      } else if (tab === 'requests') {
        // The requests component loads its own list.
      } else if (tab === 'schedules') {
        this.schedules.set((await this.api.get<ApiEnvelope<{ items: Schedule[] }>>(`${this.base()}/schedules`)).data?.items ?? []);
      } else {
        if (this.people().length === 0) {
          const response = await this.api.get<ApiEnvelope<{ items: Employee[] }>>(`${this.base()}/employees?limit=500`);
          this.people.set(response.data?.items ?? []);
        }
        await this.loadDays();
      }
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  async loadEmployees(offset: number) {
    const query = new URLSearchParams({ limit: String(PAGE), offset: String(Math.max(0, offset)) });
    if (this.search.trim()) query.set('search', this.search.trim());
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Employee[]; total: number }>>(`${this.base()}/employees?${query}`);
      this.employees.set(response.data?.items ?? []);
      this.total.set(Number(response.data?.total ?? 0));
      this.offset.set(Math.max(0, offset));
    } catch {
      this.error.set(true);
    }
  }

  /** Pending counter of the selected account after a decision. */
  async refreshCounts() {
    try {
      const response = await this.api.get<ApiEnvelope<{ items: HrAccount[] }>>('customer-portal/hr/accounts');
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      const current = items.find((item) => item.HraUUID === this.account()?.HraUUID);
      if (current) this.account.set(current);
    } catch {
      // The counter keeps its last value.
    }
  }

  setMonth(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (/^\d{4}-\d{2}$/.test(value)) {
      this.month.set(value);
      void this.loadDays();
    }
  }

  async loadDays() {
    const employee = this.employee();
    if (!employee) {
      this.days.set([]);
      return;
    }
    const { from, to } = monthRange(this.month());
    const query = new URLSearchParams({ employeeUUID: employee, from, to });
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Day[] }>>(`${this.base()}/timesheets?${query}`);
      this.days.set(response.data?.items ?? []);
    } catch {
      this.error.set(true);
    }
  }

  dayKind(kind: string): string {
    return DAY_KINDS.includes(kind) ? kind : 'work';
  }

  flagsOf(day: Day): string[] {
    return (day.Flags ?? '').split(',').map((flag) => flag.trim()).filter((flag) => FLAGS.includes(flag));
  }
}
