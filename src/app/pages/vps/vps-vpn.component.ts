import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, ApiService } from '../../services/api.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  VPN_VENDORS,
  bytesLabel,
  splitList,
  vpnState,
  type VpsVpn,
  type VpsVpnVendor,
} from './vps.model';

/** The key is hidden again after this long. */
export const PSK_VISIBLE_MS = 10_000;

/** Site-to-site VPN connections published to the customer: state, parameters, key, config. */
@Component({
  selector: 'mcp-vps-vpn',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 0) {
      <section class="vpn">
        <h2>{{ 'vps.vpn.title' | transloco }}</h2>
        <p class="hint">{{ 'vps.vpn.description' | transloco }}</p>
        <div class="list">
          @for (vpn of items(); track vpn.HvcUUID) {
            <article class="card conn">
              <div class="head">
                <span class="icon-badge"><mat-icon>vpn_lock</mat-icon></span>
                <h3>{{ vpn.HvcName }}</h3>
                <span class="state" [attr.data-state]="state(vpn)">
                  {{ 'vps.vpn.state.' + state(vpn) | transloco }}
                </span>
              </div>
              <dl>
                <dt>{{ 'vps.vpn.cloudIp' | transloco }}</dt>
                <dd>
                  @if (vpn.HpiAddress) {
                    <code>{{ vpn.HpiAddress }}</code>
                    <button
                      matIconButton
                      type="button"
                      (click)="copy(vpn.HpiAddress)"
                      [matTooltip]="'vps.copy' | transloco"
                      [attr.aria-label]="'vps.copy' | transloco"
                    >
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  } @else {
                    <span>-</span>
                  }
                </dd>
                <dt>{{ 'vps.vpn.device' | transloco }}</dt>
                <dd>
                  @if (vpn.HvcRemoteAddress) {
                    <code>{{ vpn.HvcRemoteAddress }}</code>
                  } @else {
                    <span>{{ 'vps.vpn.dynamic' | transloco }}</span>
                  }
                </dd>
                <dt>{{ 'vps.vpn.profile' | transloco }}</dt>
                <dd>{{ 'vps.vpn.profiles.' + vpn.HvcProfile | transloco }}</dd>
                <dt>{{ 'vps.vpn.companyNetworks' | transloco }}</dt>
                <dd>
                  @for (cidr of list(vpn.RemotePrefixes); track cidr) {
                    <code>{{ cidr }}</code>
                  } @empty {
                    <span>-</span>
                  }
                </dd>
                <dt>{{ 'vps.vpn.cloudNetworks' | transloco }}</dt>
                <dd>
                  @for (cidr of list(vpn.LocalNetworkCidrs); track cidr) {
                    <code>{{ cidr }}</code>
                  } @empty {
                    <span>-</span>
                  }
                </dd>
                @if (vpn.HvcMtu) {
                  <dt>MTU</dt>
                  <dd>{{ vpn.HvcMtu }}</dd>
                }
                <dt>{{ 'vps.vpn.traffic' | transloco }}</dt>
                <dd>
                  <span>↓ {{ bytes(vpn.HvcBytesIn) }}</span>
                  <span>↑ {{ bytes(vpn.HvcBytesOut) }}</span>
                </dd>
                <dt>{{ 'vps.vpn.checked' | transloco }}</dt>
                <dd>
                  @if (vpn.HvcDateChecked) {
                    {{ vpn.HvcDateChecked | date: 'short' }}
                  } @else {
                    <span>-</span>
                  }
                </dd>
              </dl>

              @if (revealed()?.uuid === vpn.HvcUUID) {
                <div class="psk" role="status">
                  <span>{{ 'vps.vpn.key' | transloco }}</span>
                  <code>{{ revealed()!.shown ? revealed()!.psk : '••••••••••••••••' }}</code>
                  <button matButton="text" type="button" (click)="toggleShown()">
                    <mat-icon>{{ revealed()!.shown ? 'visibility_off' : 'visibility' }}</mat-icon>
                    {{ (revealed()!.shown ? 'vps.vpn.hide' : 'vps.vpn.show') | transloco }}
                  </button>
                  <button matButton="text" type="button" (click)="copyKey()">
                    <mat-icon>content_copy</mat-icon>
                    {{ 'vps.copy' | transloco }}
                  </button>
                </div>
              }

              <div class="actions">
                <button
                  matButton="outlined"
                  type="button"
                  [disabled]="busy() === vpn.HvcUUID"
                  (click)="reveal(vpn)"
                >
                  <mat-icon>key</mat-icon>
                  {{ 'vps.vpn.reveal' | transloco }}
                </button>
                <button
                  matButton="filled"
                  type="button"
                  [matMenuTriggerFor]="vendors"
                  [matMenuTriggerData]="{ vpn }"
                  [disabled]="busy() === vpn.HvcUUID"
                >
                  <mat-icon>download</mat-icon>
                  {{ 'vps.vpn.download' | transloco }}
                </button>
              </div>
            </article>
          }
        </div>
      </section>
    }
    <mat-menu #vendors="matMenu">
      <ng-template matMenuContent let-vpn="vpn">
        @for (vendor of vendorList; track vendor) {
          <button mat-menu-item type="button" (click)="download(vpn, vendor)">
            {{ 'vps.vpn.vendors.' + vendor | transloco }}
          </button>
        }
      </ng-template>
    </mat-menu>
  `,
  styles: `
    .vpn {
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }
    h2,
    h3 {
      margin: 0;
    }
    h3 {
      flex: 1 1 auto;
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 17px;
      font-weight: 650;
    }
    .hint,
    dt {
      margin: 0;
      color: var(--muted);
    }
    .hint {
      font-size: 13px;
    }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .conn {
      display: grid;
      gap: 14px;
      padding: 20px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .state {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      background: var(--mat-sys-surface-container-high);
    }
    .state[data-state='established'] {
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .state[data-state='down'] {
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
    .psk {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-high);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    @media (max-width: 600px) {
      .list {
        grid-template-columns: 1fr;
      }
      .actions button {
        flex: 1 1 auto;
      }
    }
  `,
})
export class VpsVpnComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(PortalI18nService);
  private readonly snackBar = inject(MatSnackBar);
  readonly items = signal<VpsVpn[]>([]);
  readonly busy = signal<string | null>(null);
  /** Key in memory only while shown; never persisted. */
  readonly revealed = signal<{ uuid: string; psk: string; shown: boolean } | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  readonly vendorList = VPN_VENDORS;
  readonly state = vpnState;
  readonly list = splitList;
  readonly bytes = bytesLabel;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearKey());
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const response = await this.api.get<ApiEnvelope<{ items: VpsVpn[] }>>(
        'customer-portal/vps/vpn-connections',
      );
      this.items.set((response.data?.items ?? []).filter((item) => !!item?.HvcUUID));
    } catch {
      // Not published, rule off or no access: simply no VPN section.
      this.items.set([]);
    }
  }

  async reveal(vpn: VpsVpn): Promise<void> {
    this.busy.set(vpn.HvcUUID);
    try {
      const response = await this.api.post<ApiEnvelope<{ uuid: string; psk: string }>>(
        `customer-portal/vps/vpn-connections/${encodeURIComponent(vpn.HvcUUID)}/psk/reveal`,
      );
      const psk = response.data?.psk;
      if (!psk) throw new Error('empty');
      this.clearKey();
      this.revealed.set({ uuid: vpn.HvcUUID, psk, shown: false });
      this.hideTimer = setTimeout(() => this.clearKey(), PSK_VISIBLE_MS);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      this.notify(
        status === 404 || status === 403
          ? 'vps.vpn.notAllowed'
          : status === 429
            ? 'vps.vpn.tooMany'
            : 'vps.vpn.revealFailed',
      );
    } finally {
      this.busy.set(null);
    }
  }

  toggleShown(): void {
    this.revealed.update((key) => (key ? { ...key, shown: !key.shown } : key));
  }

  async copyKey(): Promise<void> {
    const key = this.revealed();
    if (key) await this.copy(key.psk);
  }

  /** Forgets the key (timer or component destroyed). */
  clearKey(): void {
    clearTimeout(this.hideTimer);
    this.revealed.set(null);
  }

  async download(vpn: VpsVpn, vendor: VpsVpnVendor): Promise<void> {
    this.busy.set(vpn.HvcUUID);
    try {
      const blob = await this.api.getBlob(
        `customer-portal/vps/vpn-connections/${encodeURIComponent(vpn.HvcUUID)}/peer-config?vendor=${vendor}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${vpn.HvcName.replace(/[^\w.-]+/g, '_')}-${vendor}.txt`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.notify('vps.vpn.downloadFailed');
    } finally {
      this.busy.set(null);
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
