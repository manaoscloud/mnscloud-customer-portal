import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, ApiService } from '../../services/api.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  snapshotBusy,
  snapshotState,
  type VpsServer,
  type VpsSnapshot,
  type VpsSnapshotList,
} from './vps.model';

/** While a snapshot job runs the list refreshes every 5 s, at most for 10 minutes. */
const REFRESH_MS = 5_000;
const REFRESH_LIMIT = 120;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,59}$/u;
const REFUSALS: Record<string, string> = {
  VPS_SNAPSHOT_LIMIT: 'vps.snapshots.limitReached',
  VPS_SNAPSHOT_STATE_CONFLICT: 'vps.snapshots.busy',
  VPS_SNAPSHOT_UNSUPPORTED: 'vps.snapshots.unsupported',
  VPS_POWER_BILLING_CONTROLLED: 'vps.powerHeld',
  VPS_OPERATION_IN_PROGRESS: 'vps.operationInProgress',
};

type Pending = { uuid: string; action: 'restore' | 'delete' };

/** Snapshots of one server: list, create, restore over the server and delete. */
@Component({
  selector: 'mcp-vps-snapshots',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'dialog', 'aria-modal': 'true', '[attr.aria-label]': 'server().HviName' },
  template: `
    <div class="frame">
      <header>
        <strong>{{ 'vps.snapshots.title' | transloco }} · {{ server().HviName }}</strong>
        <div class="actions">
          <button matButton="outlined" type="button" (click)="load()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon>
            {{ 'vps.refresh' | transloco }}
          </button>
          <button matButton="filled" type="button" (click)="closed.emit()">
            {{ 'vps.close' | transloco }}
          </button>
        </div>
      </header>

      <p class="hint">{{ 'vps.snapshots.description' | transloco }}</p>

      @if (canCreate()) {
        <form class="create" (submit)="$event.preventDefault(); create()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'vps.snapshots.name' | transloco }}</mat-label>
            <input
              matInput
              name="snapshotName"
              maxlength="60"
              [ngModel]="name()"
              (ngModelChange)="name.set($event)"
              [placeholder]="'vps.snapshots.namePlaceholder' | transloco"
            />
            <mat-hint>
              {{
                'vps.snapshots.usage'
                  | transloco: { count: list()!.activeCount, limit: list()!.limit }
              }}
            </mat-hint>
          </mat-form-field>
          <button matButton="filled" type="submit" [disabled]="!validName() || working()">
            <mat-icon>add_a_photo</mat-icon>
            {{ 'vps.snapshots.create' | transloco }}
          </button>
        </form>
      } @else if (list()?.canManage === 1 && atLimit()) {
        <p class="hint">{{ 'vps.snapshots.limitReached' | transloco }}</p>
      }

      @if (error()) {
        <p class="notice" role="alert">{{ 'vps.snapshots.error' | transloco }}</p>
      } @else if (loading() && !list()) {
        <p role="status">{{ 'vps.snapshots.loading' | transloco }}</p>
      } @else if (list() && list()!.items.length === 0) {
        <p class="notice">{{ 'vps.snapshots.empty' | transloco }}</p>
      }

      <ul class="items">
        @for (snapshot of list()?.items ?? []; track snapshot.HvsUUID) {
          <li>
            <div class="info">
              <strong>{{ snapshot.HvsName }}</strong>
              <small>
                {{ snapshot.DateCreated }}
                @if (snapshot.SizeGb) {
                  · {{ snapshot.SizeGb }} GB
                }
              </small>
            </div>
            <span class="state" [attr.data-state]="state(snapshot)">
              {{ 'vps.snapshots.state.' + state(snapshot) | transloco }}
            </span>
            @if (list()?.canManage === 1) {
              <div class="row-actions">
                @if (pending()?.uuid === snapshot.HvsUUID) {
                  <span class="confirm">
                    {{ 'vps.snapshots.confirm.' + pending()!.action | transloco }}
                  </span>
                  <button matButton="text" type="button" (click)="pending.set(null)">
                    {{ 'vps.cancel' | transloco }}
                  </button>
                  <button
                    matButton="filled"
                    type="button"
                    [disabled]="working()"
                    (click)="run(snapshot, pending()!.action)"
                  >
                    {{ 'vps.snapshots.' + pending()!.action | transloco }}
                  </button>
                } @else {
                  @if (canRestore(snapshot)) {
                    <button
                      matButton="outlined"
                      type="button"
                      (click)="pending.set({ uuid: snapshot.HvsUUID, action: 'restore' })"
                    >
                      <mat-icon>settings_backup_restore</mat-icon>
                      {{ 'vps.snapshots.restore' | transloco }}
                    </button>
                  }
                  @if (!busy(snapshot)) {
                    <button
                      matButton="outlined"
                      type="button"
                      (click)="pending.set({ uuid: snapshot.HvsUUID, action: 'delete' })"
                    >
                      <mat-icon>delete</mat-icon>
                      {{ 'vps.snapshots.delete' | transloco }}
                    </button>
                  }
                }
              </div>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgb(0 0 0 / 60%);
    }
    .frame {
      display: grid;
      gap: 14px;
      width: min(760px, 100%);
      max-height: 100%;
      overflow: auto;
      padding: 16px;
      border-radius: var(--radius, 12px);
      background: var(--surface);
    }
    header,
    .actions,
    .create,
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    header {
      justify-content: space-between;
    }
    .create mat-form-field {
      flex: 1 1 260px;
    }
    .hint,
    small {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
    .notice {
      margin: 0;
    }
    .items {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 12px;
      border-radius: var(--radius, 12px);
      background: var(--mat-sys-surface-container);
    }
    .info {
      display: grid;
      flex: 1 1 200px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .state {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: var(--mat-sys-surface-container-high);
    }
    .state[data-state='available'] {
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .state[data-state='failed'] {
      color: var(--mat-sys-on-error-container);
      background: var(--mat-sys-error-container);
    }
    .row-actions {
      justify-content: flex-end;
    }
    .confirm {
      flex: 1 1 100%;
      font-size: 13px;
    }
    @media (max-width: 600px) {
      .row-actions,
      .row-actions button {
        flex: 1 1 auto;
      }
    }
  `,
})
export class VpsSnapshotsComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(PortalI18nService);
  private readonly snackBar = inject(MatSnackBar);
  readonly server = input.required<VpsServer>();
  readonly closed = output<void>();
  readonly list = signal<VpsSnapshotList | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly working = signal(false);
  readonly name = signal('');
  readonly pending = signal<Pending | null>(null);
  readonly state = snapshotState;
  readonly busy = snapshotBusy;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshes = 0;

  readonly validName = computed(() => NAME_RE.test(this.name().trim()));
  readonly atLimit = computed(() => {
    const list = this.list();
    return !!list && list.activeCount >= list.limit;
  });
  readonly canCreate = computed(() => {
    const list = this.list();
    return !!list && list.canManage === 1 && list.capabilities.create && !this.atLimit();
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    queueMicrotask(() => void this.load());
  }

  canRestore(snapshot: VpsSnapshot): boolean {
    return !!this.list()?.capabilities.restore && snapshotState(snapshot) === 'available';
  }

  private endpoint(suffix = ''): string {
    return `customer-portal/vps/instances/${this.server().HviUUID}/snapshots${suffix}`;
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<VpsSnapshotList>>(this.endpoint());
      this.list.set(response.data ?? null);
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
    this.scheduleRefresh();
  }

  /** Follows running snapshot jobs until they settle (or the limit is reached). */
  private scheduleRefresh(): void {
    clearTimeout(this.timer);
    const running = (this.list()?.items ?? []).some((snapshot) => snapshotBusy(snapshot));
    if (!running || this.refreshes >= REFRESH_LIMIT) {
      if (!running) this.refreshes = 0;
      return;
    }
    this.refreshes += 1;
    this.timer = setTimeout(() => void this.load(), REFRESH_MS);
  }

  async create(): Promise<void> {
    const name = this.name().trim();
    if (!NAME_RE.test(name)) return;
    await this.write(
      () => this.api.post(this.endpoint(), { name }),
      'vps.snapshots.created',
      () => this.name.set(''),
    );
  }

  async run(snapshot: VpsSnapshot, action: Pending['action']): Promise<void> {
    await this.write(
      () =>
        action === 'restore'
          ? this.api.post(this.endpoint(`/${snapshot.HvsUUID}/restore`), {})
          : this.api.delete(this.endpoint(`/${snapshot.HvsUUID}`)),
      action === 'restore' ? 'vps.snapshots.restoring' : 'vps.snapshots.deleted',
    );
  }

  private async write(
    call: () => Promise<unknown>,
    done: string,
    after?: () => void,
  ): Promise<void> {
    this.working.set(true);
    try {
      await call();
      after?.();
      this.notify(done);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      this.notify((code && REFUSALS[code]) ?? 'vps.snapshots.failed');
    } finally {
      this.working.set(false);
      this.pending.set(null);
      this.refreshes = 0;
      void this.load();
    }
  }

  private notify(key: string): void {
    this.snackBar.open(this.i18n.t(key), this.i18n.t('common.ok'), { duration: 6000 });
  }
}
