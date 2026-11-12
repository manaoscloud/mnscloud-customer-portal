import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, ApiService } from '../../services/api.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  blocksAllInbound,
  parseSources,
  ruleInput,
  ruleTraffic,
  type VpsFirewallRule,
  type VpsNetwork,
  type VpsServer,
} from './vps.model';

type Draft = {
  direction: 'in' | 'out';
  protocol: VpsFirewallRule['Protocol'];
  ports: string;
  sources: string;
  comment: string;
};

const EMPTY_DRAFT: Draft = {
  direction: 'in',
  protocol: 'tcp',
  ports: '',
  sources: '',
  comment: '',
};
const REFUSALS: Record<string, string> = {
  VPS_OPERATION_IN_PROGRESS: 'vps.operationInProgress',
  VALIDATION_FAILED: 'vps.network.invalid',
};

/** "22", "1000-2000" or "" → port range (tcp/udp only). */
export function parsePorts(text: string): { from: number | null; to: number | null } | null {
  const value = text.trim();
  if (!value) return { from: null, to: null };
  const match = /^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/.exec(value);
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : null;
  if (from < 1 || from > 65535 || (to !== null && (to < from || to > 65535))) return null;
  return { from, to };
}

/** Network of one server: public IPs with reverse DNS and the firewall rules. */
@Component({
  selector: 'mcp-vps-network',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'dialog', 'aria-modal': 'true', '[attr.aria-label]': 'server().HviName' },
  template: `
    <div class="frame">
      <header>
        <strong>{{ 'vps.network.title' | transloco }} · {{ server().HviName }}</strong>
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

      @if (error()) {
        <p role="alert">{{ 'vps.network.error' | transloco }}</p>
      } @else if (!network()) {
        <p role="status">{{ 'vps.network.loading' | transloco }}</p>
      } @else {
        <section>
          <h3>{{ 'vps.network.reverseDns' | transloco }}</h3>
          @if (network()!.publicIps.length === 0) {
            <p class="hint">{{ 'vps.network.noPoolIps' | transloco }}</p>
          }
          @for (ip of network()!.publicIps; track ip.HpiUUID) {
            <div class="row">
              <code>{{ ip.Address }}</code>
              @if (editingIp() === ip.HpiUUID) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'vps.network.ptrName' | transloco }}</mat-label>
                  <input
                    matInput
                    name="ptr"
                    maxlength="253"
                    [ngModel]="ptrDraft()"
                    (ngModelChange)="ptrDraft.set($event)"
                    [placeholder]="'vps.network.ptrPlaceholder' | transloco"
                  />
                  <mat-hint>{{ 'vps.network.ptrHint' | transloco }}</mat-hint>
                </mat-form-field>
                <button matButton="text" type="button" (click)="editingIp.set(null)">
                  {{ 'vps.cancel' | transloco }}
                </button>
                <button
                  matButton="filled"
                  type="button"
                  [disabled]="working()"
                  (click)="savePtr(ip.HpiUUID)"
                >
                  {{ 'vps.network.save' | transloco }}
                </button>
              } @else {
                <span class="name">{{ ip.PtrName || ('vps.network.ptrDefault' | transloco) }}</span>
                @if (network()!.canNetwork === 1) {
                  <button
                    matButton="outlined"
                    type="button"
                    (click)="editPtr(ip.HpiUUID, ip.PtrName)"
                  >
                    <mat-icon>edit</mat-icon>
                    {{ 'vps.network.edit' | transloco }}
                  </button>
                }
              }
            </div>
          }
        </section>

        <section>
          <h3>{{ 'vps.network.firewall' | transloco }}</h3>
          @if (network()!.firewalls.length === 0) {
            <p class="hint">{{ 'vps.network.noFirewall' | transloco }}</p>
          }
          @for (firewall of network()!.firewalls; track firewall.HvfUUID) {
            <div class="firewall">
              <div class="row">
                <strong>{{ firewall.Name }}</strong>
                <span
                  class="state"
                  [attr.data-state]="firewall.Pending ? 'pending' : firewall.Status"
                >
                  {{
                    'vps.network.status.' +
                      (firewall.Pending ? 'pending' : firewallStatus(firewall.Status)) | transloco
                  }}
                </span>
                @if (firewall.Managed !== 1) {
                  <small>{{ 'vps.network.sharedHint' | transloco }}</small>
                }
              </div>
              <ul class="rules">
                @for (rule of rulesOf(firewall); track $index) {
                  <li>
                    <span class="badge">{{
                      'vps.network.direction.' + rule.Direction | transloco
                    }}</span>
                    <span>{{ traffic(rule) }}</span>
                    <span class="sources">
                      {{ sourcesText(rule) }}
                      @if (rule.RemoteNetworkCount) {
                        ·
                        {{
                          'vps.network.privateNetworks'
                            | transloco: { count: rule.RemoteNetworkCount }
                        }}
                      }
                    </span>
                    @if (rule.Action === 'deny') {
                      <span class="badge deny">{{ 'vps.network.deny' | transloco }}</span>
                    }
                    @if (rule.Comment) {
                      <small>{{ rule.Comment }}</small>
                    }
                    @if (editable(firewall)) {
                      <button
                        matIconButton
                        type="button"
                        (click)="removeRule($index)"
                        [attr.aria-label]="'vps.network.removeRule' | transloco"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </li>
                }
              </ul>

              @if (editable(firewall)) {
                <form class="add" (submit)="$event.preventDefault(); addRule()">
                  @if (network()!.firewall?.outbound) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>{{ 'vps.network.directionLabel' | transloco }}</mat-label>
                      <mat-select
                        name="direction"
                        [ngModel]="draft().direction"
                        (ngModelChange)="patch({ direction: $event })"
                      >
                        <mat-option value="in">{{
                          'vps.network.direction.in' | transloco
                        }}</mat-option>
                        <mat-option value="out">{{
                          'vps.network.direction.out' | transloco
                        }}</mat-option>
                      </mat-select>
                    </mat-form-field>
                  }
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'vps.network.protocol' | transloco }}</mat-label>
                    <mat-select
                      name="protocol"
                      [ngModel]="draft().protocol"
                      (ngModelChange)="patch({ protocol: $event })"
                    >
                      @for (protocol of protocols(); track protocol) {
                        <mat-option [value]="protocol">{{ protocol.toUpperCase() }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  @if (draft().protocol === 'tcp' || draft().protocol === 'udp') {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>{{ 'vps.network.ports' | transloco }}</mat-label>
                      <input
                        matInput
                        name="ports"
                        [ngModel]="draft().ports"
                        (ngModelChange)="patch({ ports: $event })"
                        placeholder="443 / 1000-2000"
                      />
                    </mat-form-field>
                  }
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                    <mat-label>{{ 'vps.network.sources' | transloco }}</mat-label>
                    <input
                      matInput
                      name="sources"
                      [ngModel]="draft().sources"
                      (ngModelChange)="patch({ sources: $event })"
                      [placeholder]="'vps.network.sourcesPlaceholder' | transloco"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'vps.network.comment' | transloco }}</mat-label>
                    <input
                      matInput
                      name="comment"
                      maxlength="255"
                      [ngModel]="draft().comment"
                      (ngModelChange)="patch({ comment: $event })"
                    />
                  </mat-form-field>
                  <button
                    matButton="outlined"
                    type="submit"
                    [disabled]="!draftValid() || atLimit()"
                  >
                    <mat-icon>add</mat-icon>
                    {{ 'vps.network.addRule' | transloco }}
                  </button>
                </form>
                @if (atLimit()) {
                  <p class="hint">
                    {{ 'vps.network.limit' | transloco: { max: network()!.firewall!.maxRules } }}
                  </p>
                }
                @if (dirty()) {
                  @if (closesEverything()) {
                    <p class="warning" role="alert">{{ 'vps.network.blocksAll' | transloco }}</p>
                  }
                  <div class="actions end">
                    <button matButton="text" type="button" (click)="discard()">
                      {{ 'vps.network.discard' | transloco }}
                    </button>
                    <button
                      matButton="filled"
                      type="button"
                      [disabled]="working()"
                      (click)="saveRules()"
                    >
                      {{ 'vps.network.apply' | transloco }}
                    </button>
                  </div>
                }
              }
            </div>
          }
        </section>
      }
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
      gap: 16px;
      width: min(900px, 100%);
      max-height: 100%;
      overflow: auto;
      padding: 16px;
      border-radius: var(--radius, 12px);
      background: var(--surface);
    }
    header,
    .actions,
    .row,
    .add,
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    header {
      justify-content: space-between;
    }
    .end {
      justify-content: flex-end;
    }
    section {
      display: grid;
      gap: 10px;
    }
    h3 {
      margin: 0;
      font-size: 15px;
    }
    .hint,
    small,
    .sources {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
    .name,
    code {
      overflow-wrap: anywhere;
    }
    .firewall {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: var(--radius, 12px);
      background: var(--mat-sys-surface-container);
    }
    .rules {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .badge,
    .state {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: var(--mat-sys-surface-container-high);
    }
    .deny,
    .state[data-state='failed'] {
      color: var(--mat-sys-on-error-container);
      background: var(--mat-sys-error-container);
    }
    .state[data-state='applied'] {
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .warning {
      margin: 0;
      color: var(--mat-sys-error);
      font-size: 13px;
    }
    .add mat-form-field {
      flex: 1 1 140px;
    }
    .add .wide {
      flex: 2 1 220px;
    }
    @media (max-width: 600px) {
      .add mat-form-field,
      .add button {
        flex: 1 1 100%;
      }
    }
  `,
})
export class VpsNetworkComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(PortalI18nService);
  private readonly snackBar = inject(MatSnackBar);
  readonly server = input.required<VpsServer>();
  readonly closed = output<void>();
  readonly network = signal<VpsNetwork | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly working = signal(false);
  readonly editingIp = signal<string | null>(null);
  readonly ptrDraft = signal('');
  readonly draft = signal<Draft>({ ...EMPTY_DRAFT });
  /** Edited rule set of the dedicated profile (null = unchanged). */
  readonly edited = signal<VpsFirewallRule[] | null>(null);
  readonly traffic = ruleTraffic;

  readonly managed = computed(
    () => this.network()?.firewalls.find((item) => item.Managed === 1) ?? null,
  );
  readonly dirty = computed(() => this.edited() !== null);
  readonly currentRules = computed(() => this.edited() ?? this.managed()?.Rules ?? []);
  readonly atLimit = computed(() => {
    const max = this.network()?.firewall?.maxRules ?? 0;
    return this.currentRules().length >= max;
  });
  readonly closesEverything = computed(() => blocksAllInbound(this.currentRules()));
  readonly protocols = computed(() => {
    const list: VpsFirewallRule['Protocol'][] = ['tcp', 'udp', 'icmp'];
    if (this.network()?.firewall?.icmpv6) list.push('icmpv6');
    return list;
  });
  readonly draftValid = computed(() => {
    const draft = this.draft();
    if (draft.protocol === 'tcp' || draft.protocol === 'udp')
      return parsePorts(draft.ports) !== null;
    return true;
  });

  constructor() {
    queueMicrotask(() => void this.load());
  }

  private endpoint(suffix: string): string {
    return `customer-portal/vps/instances/${this.server().HviUUID}${suffix}`;
  }

  editable(firewall: VpsNetwork['firewalls'][number]): boolean {
    return (
      firewall.Managed === 1 && this.network()?.canFirewall === 1 && !!this.network()?.firewall
    );
  }

  rulesOf(firewall: VpsNetwork['firewalls'][number]): VpsFirewallRule[] {
    return firewall.Managed === 1 ? this.currentRules() : firewall.Rules;
  }

  sourcesText(rule: VpsFirewallRule): string {
    const any =
      rule.RemoteCidrs.length === 0 ||
      rule.RemoteCidrs.every((cidr) => cidr === '0.0.0.0/0' || cidr === '::/0');
    return any ? this.i18n.t('vps.network.anywhere') : rule.RemoteCidrs.join(', ');
  }

  firewallStatus(status: string): string {
    return ['applied', 'failed'].includes(status) ? status : 'pending';
  }

  patch(change: Partial<Draft>): void {
    this.draft.update((draft) => ({ ...draft, ...change }));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<VpsNetwork>>(this.endpoint('/network'));
      this.network.set(response.data ?? null);
      this.edited.set(null);
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  editPtr(uuid: string, current: string | null): void {
    this.ptrDraft.set(current ?? '');
    this.editingIp.set(uuid);
  }

  async savePtr(uuid: string): Promise<void> {
    await this.write(
      () =>
        this.api.put(this.endpoint(`/public-ips/${uuid}/ptr`), { ptrName: this.ptrDraft().trim() }),
      'vps.network.ptrSaved',
    );
    this.editingIp.set(null);
  }

  addRule(): void {
    const draft = this.draft();
    const ports =
      draft.protocol === 'tcp' || draft.protocol === 'udp'
        ? parsePorts(draft.ports)
        : { from: null, to: null };
    if (!ports) return;
    const rule: VpsFirewallRule = {
      Direction: draft.direction,
      Action: 'allow',
      Protocol: draft.protocol,
      PortFrom: ports.from,
      PortTo: ports.to,
      RemoteCidrs:
        draft.protocol === 'icmpv6'
          ? parseSources(draft.sources).filter((cidr) => cidr.includes(':'))
          : draft.protocol === 'icmp'
            ? parseSources(draft.sources).filter((cidr) => !cidr.includes(':'))
            : parseSources(draft.sources),
      RemoteNetworkCount: 0,
      Priority: (this.currentRules().length + 1) * 10,
      Comment: draft.comment.trim() || null,
    };
    this.edited.set([...this.currentRules(), rule]);
    this.draft.set({ ...EMPTY_DRAFT, direction: draft.direction });
  }

  removeRule(index: number): void {
    this.edited.set(this.currentRules().filter((_, i) => i !== index));
  }

  discard(): void {
    this.edited.set(null);
  }

  async saveRules(): Promise<void> {
    const rules = this.currentRules().map(ruleInput);
    await this.write(
      () => this.api.put(this.endpoint('/firewall'), { rules }),
      'vps.network.rulesSaved',
    );
  }

  private async write(call: () => Promise<unknown>, done: string): Promise<void> {
    this.working.set(true);
    try {
      await call();
      this.notify(done);
      await this.load();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      this.notify((code && REFUSALS[code]) ?? 'vps.network.failed');
    } finally {
      this.working.set(false);
    }
  }

  private notify(key: string): void {
    this.snackBar.open(this.i18n.t(key), this.i18n.t('common.ok'), { duration: 6000 });
  }
}
