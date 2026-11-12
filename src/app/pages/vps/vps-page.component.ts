import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, ApiService } from '../../services/api.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import type { ApiEnvelope } from '../../models/session.model';
import { VpsConsoleComponent } from './vps-console.component';
import {
  memoryLabel,
  powerActions,
  serverState,
  type VpsPowerAction,
  type VpsServer,
} from './vps.model';

const POWER_ICONS: Record<VpsPowerAction, string> = {
  start: 'play_arrow',
  stop: 'power_settings_new',
  reboot: 'restart_alt',
};
/** While a server changes state the list refreshes every 5 s, at most for 2 minutes. */
const REFRESH_MS = 5_000;
const REFRESH_LIMIT = 24;

@Component({
  selector: 'mcp-vps-page',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe, VpsConsoleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'vps.title' | transloco }}</h1>
          <p>{{ 'vps.description' | transloco }}</p>
        </div>
        <button matButton="outlined" type="button" (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          {{ 'vps.refresh' | transloco }}
        </button>
      </header>

      @if (error()) {
        <p class="card notice" role="alert">{{ 'vps.error' | transloco }}</p>
      } @else if (loading() && servers().length === 0) {
        <p role="status">{{ 'vps.loading' | transloco }}</p>
      } @else if (servers().length === 0) {
        <div class="card empty-state">
          <mat-icon>dns</mat-icon>
          <p>{{ 'vps.empty' | transloco }}</p>
        </div>
      }

      <div class="servers">
        @for (server of servers(); track server.HviUUID) {
          <article class="card server">
            <div class="head">
              <span class="icon-badge"><mat-icon>dns</mat-icon></span>
              <div class="name">
                <h2>{{ server.HviName }}</h2>
                @if (server.PlanName) {
                  <small>{{ server.PlanName }}</small>
                }
              </div>
              <span class="state" [attr.data-state]="state(server)">
                {{ 'vps.state.' + state(server) | transloco }}
              </span>
            </div>

            @if (server.PowerHeld === 1) {
              <p class="hint">{{ 'vps.heldHint' | transloco }}</p>
            }

            <dl>
              @if (server.PublicIpv4) {
                <dt>{{ 'vps.publicIpv4' | transloco }}</dt>
                <dd>
                  <code>{{ server.PublicIpv4 }}</code>
                  <button
                    matIconButton
                    type="button"
                    (click)="copy(server.PublicIpv4)"
                    [matTooltip]="'vps.copy' | transloco"
                    [attr.aria-label]="'vps.copy' | transloco"
                  >
                    <mat-icon>content_copy</mat-icon>
                  </button>
                </dd>
              }
              @if (server.PublicIpv6) {
                <dt>{{ 'vps.publicIpv6' | transloco }}</dt>
                <dd><code>{{ server.PublicIpv6 }}</code></dd>
              }
              @if (server.PrivateIpv4) {
                <dt>{{ 'vps.privateIpv4' | transloco }}</dt>
                <dd><code>{{ server.PrivateIpv4 }}</code></dd>
              }
              @if (server.Username) {
                <dt>{{ 'vps.user' | transloco }}</dt>
                <dd><code>{{ server.Username }}</code></dd>
              }
              @if (server.Vcpus || memory(server) || server.DiskGb) {
                <dt>{{ 'vps.resources' | transloco }}</dt>
                <dd>
                  @if (server.Vcpus) {
                    <span>{{ server.Vcpus }} vCPU</span>
                  }
                  @if (memory(server); as ram) {
                    <span>{{ ram }} RAM</span>
                  }
                  @if (server.DiskGb) {
                    <span>{{ server.DiskGb }} GB {{ 'vps.disk' | transloco }}</span>
                  }
                </dd>
              }
            </dl>

            <div class="actions">
              @if (confirming()?.uuid === server.HviUUID) {
                <span class="confirm">
                  {{ 'vps.confirm.' + confirming()!.action | transloco }}
                </span>
                <button matButton="text" type="button" (click)="confirming.set(null)">
                  {{ 'vps.cancel' | transloco }}
                </button>
                <button
                  matButton="filled"
                  type="button"
                  [disabled]="busy() === server.HviUUID"
                  (click)="power(server, confirming()!.action)"
                >
                  {{ 'vps.power.' + confirming()!.action | transloco }}
                </button>
              } @else {
                @for (action of actions(server); track action) {
                  <button
                    matButton="outlined"
                    type="button"
                    [disabled]="busy() === server.HviUUID"
                    (click)="confirming.set({ uuid: server.HviUUID, action })"
                  >
                    <mat-icon>{{ icon(action) }}</mat-icon>
                    {{ 'vps.power.' + action | transloco }}
                  </button>
                }
                @if (server.CanConsole === 1 && state(server) === 'running') {
                  <button matButton="filled" type="button" (click)="console.set(server)">
                    <mat-icon>terminal</mat-icon>
                    {{ 'vps.openConsole' | transloco }}
                  </button>
                }
              }
            </div>
          </article>
        }
      </div>
    </section>

    @if (console(); as server) {
      <mcp-vps-console [server]="server" (closed)="console.set(null)" />
    }
  `,
  styles: `
    .notice {
      padding: 16px;
    }
    .servers {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .server {
      display: grid;
      gap: 14px;
      padding: 20px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .name {
      flex: 1 1 auto;
      min-width: 0;
    }
    h2 {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 17px;
      font-weight: 650;
    }
    small,
    .hint,
    dt {
      color: var(--muted);
    }
    .hint {
      margin: 0;
      font-size: 13px;
    }
    .state {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      background: var(--mat-sys-surface-container-high);
    }
    .state[data-state='running'] {
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .state[data-state='held'] {
      color: var(--mat-sys-on-error-container);
      background: var(--mat-sys-error-container);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 6px 12px;
      margin: 0;
    }
    dd {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 10px;
      margin: 0;
      min-width: 0;
    }
    code {
      overflow-wrap: anywhere;
      user-select: all;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .confirm {
      flex: 1 1 100%;
      font-size: 13px;
    }
    @media (max-width: 600px) {
      .servers {
        grid-template-columns: 1fr;
      }
      .actions {
        justify-content: stretch;
      }
      .actions button {
        flex: 1 1 auto;
      }
    }
  `,
})
export class VpsPageComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(PortalI18nService);
  private readonly snackBar = inject(MatSnackBar);
  readonly servers = signal<VpsServer[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly busy = signal<string | null>(null);
  readonly confirming = signal<{ uuid: string; action: VpsPowerAction } | null>(null);
  readonly console = signal<VpsServer | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshes = 0;

  readonly state = serverState;
  readonly actions = powerActions;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    void this.load();
  }

  icon(action: VpsPowerAction): string {
    return POWER_ICONS[action];
  }

  memory(server: VpsServer): string | null {
    return memoryLabel(server.MemoryMb);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: VpsServer[] }>>(
        'customer-portal/vps/instances',
      );
      this.servers.set(response.data?.items ?? []);
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
    this.scheduleRefresh();
  }

  /** Follows servers that are changing state until they settle (or the limit is reached). */
  private scheduleRefresh(): void {
    clearTimeout(this.timer);
    const changing = this.servers().some((server) => serverState(server) === 'pending');
    if (!changing || this.refreshes >= REFRESH_LIMIT) {
      if (!changing) this.refreshes = 0;
      return;
    }
    this.refreshes += 1;
    this.timer = setTimeout(() => void this.load(), REFRESH_MS);
  }

  async power(server: VpsServer, action: VpsPowerAction): Promise<void> {
    this.busy.set(server.HviUUID);
    try {
      const response = await this.api.post<ApiEnvelope<{ item?: VpsServer }>>(
        `customer-portal/vps/instances/${server.HviUUID}/power`,
        { action },
      );
      const item = response.data?.item;
      if (item) {
        this.servers.update((list) => list.map((row) => (row.HviUUID === item.HviUUID ? item : row)));
      }
      this.notify(`vps.queued.${action}`);
      this.refreshes = 0;
      this.scheduleRefresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      this.notify(
        code === 'VPS_POWER_BILLING_CONTROLLED'
          ? 'vps.powerHeld'
          : code === 'VPS_POWER_STATE_CONFLICT'
            ? 'vps.powerConflict'
            : 'vps.powerFailed',
      );
      void this.load();
    } finally {
      this.busy.set(null);
      this.confirming.set(null);
    }
  }

  async copy(value: string | null): Promise<void> {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    this.notify('vps.copied');
  }

  private notify(key: string): void {
    this.snackBar.open(this.i18n.t(key), this.i18n.t('common.ok'), { duration: 5000 });
  }
}
