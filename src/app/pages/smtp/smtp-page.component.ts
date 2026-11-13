import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import { RuntimeConfigService } from '../../core/runtime/runtime-config.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  curlExample,
  dailyPercent,
  maskedKey,
  messageStatus,
  messageTime,
  senderLabel,
  statusTone,
  type SmtpAccount,
  type SmtpMessage,
  type SmtpSendKey,
} from './smtp.model';

/** SMTP sending accounts of the customer: usage, send key (shown once) and recent messages (V5). */
@Component({
  selector: 'mcp-smtp-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'smtp.title' | transloco }}</h1>
          <p>{{ 'smtp.description' | transloco }}</p>
        </div>
        <button matButton="outlined" type="button" (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          {{ 'smtp.refresh' | transloco }}
        </button>
      </header>

      @if (error()) {
        <p class="card notice" role="alert">{{ 'smtp.error' | transloco }}</p>
      } @else if (loading() && accounts().length === 0) {
        <p role="status">{{ 'smtp.loading' | transloco }}</p>
      } @else if (accounts().length === 0) {
        <div class="card empty-state">
          <mat-icon>mail</mat-icon>
          <p>{{ 'smtp.empty' | transloco }}</p>
        </div>
      }

      @if (accounts().length > 0) {
        <details class="card help">
          <summary>{{ 'smtp.how.title' | transloco }}</summary>
          <pre>{{ example }}</pre>
          <ul>
            <li>{{ 'smtp.how.limits' | transloco }}</li>
            <li>{{ 'smtp.how.optional' | transloco }}</li>
          </ul>
        </details>
      }

      <div class="accounts">
        @for (account of accounts(); track account.HsaUUID) {
          <article class="card account">
            <div class="head">
              <span class="icon-badge"><mat-icon>mail</mat-icon></span>
              <div class="name">
                <h2>{{ account.HsaName }}</h2>
                <small>{{ sender(account) }}</small>
              </div>
              <button
                matButton="outlined"
                type="button"
                [attr.aria-expanded]="open() === account.HsaUUID"
                (click)="toggle(account)"
              >
                <mat-icon>{{
                  open() === account.HsaUUID ? 'expand_less' : 'expand_more'
                }}</mat-icon>
                {{ 'smtp.messages' | transloco }}
              </button>
            </div>

            <div class="row usage">
              <span>
                {{ 'smtp.sentToday' | transloco }}: {{ account.SentToday }} /
                {{ account.DailyLimit }}
              </span>
              <span>
                {{ 'smtp.acceptedToday' | transloco }}: {{ account.QueuedToday }} ·
                {{ 'smtp.sentMonth' | transloco }}: {{ account.SentMonth }}
              </span>
            </div>
            @if (percent(account) !== null) {
              <div
                class="bar"
                role="progressbar"
                [attr.aria-valuenow]="percent(account)"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-label]="'smtp.usage' | transloco"
              >
                <span [style.width.%]="percent(account)"></span>
              </div>
            }

            <div class="row key">
              @if (masked(account); as key) {
                <span>
                  {{ 'smtp.key' | transloco }}: <code>{{ key }}</code>
                  @if (account.SendKeyCreatedAt) {
                    · {{ account.SendKeyCreatedAt | date: 'short' }}
                  }
                </span>
              } @else {
                <span class="hint">{{ 'smtp.noKey' | transloco }}</span>
              }
              @if (canManage(account) && confirming() !== account.HsaUUID) {
                <button matButton="outlined" type="button" (click)="askKey(account)">
                  <mat-icon>key</mat-icon>
                  {{ 'smtp.generateKey' | transloco }}
                </button>
              }
            </div>

            @if (confirming() === account.HsaUUID) {
              <div class="panel" role="alertdialog">
                <p>{{ 'smtp.confirmKey' | transloco }}</p>
                <div class="actions">
                  <button matButton="filled" type="button" (click)="generateKey(account)">
                    {{ 'smtp.confirm' | transloco }}
                  </button>
                  <button matButton="outlined" type="button" (click)="cancelKey()">
                    {{ 'smtp.cancel' | transloco }}
                  </button>
                </div>
              </div>
            }
            @if (keyError() === account.HsaUUID) {
              <p class="hint" role="alert">{{ 'smtp.keyError' | transloco }}</p>
            }
            @if (newKey(); as created) {
              @if (newKeyFor() === account.HsaUUID) {
                <div class="panel" role="dialog">
                  <p>
                    <strong>{{ 'smtp.keyOnce' | transloco }}</strong>
                  </p>
                  <code class="secret">{{ created.sendKey }}</code>
                  <div class="actions">
                    <button matButton="filled" type="button" (click)="copy(created.sendKey)">
                      <mat-icon>content_copy</mat-icon>
                      {{ (copied() ? 'smtp.copied' : 'smtp.copy') | transloco }}
                    </button>
                    <button matButton="outlined" type="button" (click)="closeKey()">
                      {{ 'smtp.close' | transloco }}
                    </button>
                  </div>
                </div>
              }
            }

            @if (open() === account.HsaUUID) {
              @if (messagesError()) {
                <p class="hint" role="alert">{{ 'smtp.messagesError' | transloco }}</p>
              } @else if (messagesLoading()) {
                <p class="hint" role="status">{{ 'smtp.loading' | transloco }}</p>
              } @else if (messages().length === 0) {
                <p class="hint">{{ 'smtp.noMessages' | transloco }}</p>
              } @else {
                <ul class="messages">
                  @for (message of messages(); track message.HsmUUID) {
                    <li>
                      <div class="row">
                        <strong class="subject">{{
                          message.Subject || ('smtp.noSubject' | transloco)
                        }}</strong>
                        <span class="state" [attr.data-tone]="tone(message)">
                          {{ 'smtp.status.' + status(message) | transloco }}
                        </span>
                      </div>
                      <div class="row usage">
                        <span>
                          {{ message.FirstRecipient }}
                          @if (message.RecipientCount > 1) {
                            (+{{ message.RecipientCount - 1 }})
                          }
                        </span>
                        <span>{{ time(message) | date: 'short' }}</span>
                      </div>
                    </li>
                  }
                </ul>
              }
            }
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .notice {
      padding: 16px;
    }
    .accounts {
      display: grid;
      gap: 16px;
    }
    .account,
    .help {
      display: grid;
      gap: 12px;
      padding: 20px;
    }
    .help summary {
      cursor: pointer;
      font-weight: 600;
    }
    pre,
    .secret {
      margin: 0;
      padding: 12px;
      overflow-x: auto;
      border-radius: 12px;
      font-size: 12px;
      background: var(--mat-sys-surface-container);
    }
    .secret {
      display: block;
      overflow-wrap: anywhere;
      user-select: all;
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
    .hint {
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .hint {
      margin: 0;
      font-size: 13px;
    }
    .panel {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    .panel p {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .messages {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .messages li {
      display: grid;
      gap: 6px;
      padding: 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px 12px;
    }
    .subject {
      overflow-wrap: anywhere;
    }
    .usage {
      font-size: 13px;
      color: var(--muted);
    }
    .state {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      background: var(--mat-sys-surface-container-high);
    }
    .state[data-tone='ok'] {
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .state[data-tone='bad'] {
      color: var(--mat-sys-on-error-container);
      background: var(--mat-sys-error-container);
    }
    .bar {
      height: 6px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-highest);
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--mat-sys-primary);
    }
    @media (max-width: 600px) {
      .head {
        flex-wrap: wrap;
      }
      .head button {
        flex: 1 1 100%;
      }
    }
  `,
})
export class SmtpPageComponent {
  private readonly api = inject(ApiService);
  readonly example = curlExample(inject(RuntimeConfigService).apiBaseUrl);
  readonly accounts = signal<SmtpAccount[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly open = signal<string | null>(null);
  readonly messages = signal<SmtpMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly messagesError = signal(false);
  readonly confirming = signal<string | null>(null);
  readonly keyError = signal<string | null>(null);
  /** The secret lives only here, until the customer closes the panel. */
  readonly newKey = signal<SmtpSendKey | null>(null);
  readonly newKeyFor = signal<string | null>(null);
  readonly copied = signal(false);

  readonly percent = dailyPercent;
  readonly sender = senderLabel;
  readonly masked = (account: SmtpAccount) => maskedKey(account.SendKeyPrefix);
  readonly status = messageStatus;
  readonly time = messageTime;
  readonly tone = (message: SmtpMessage) => statusTone(messageStatus(message));
  readonly canManage = (account: SmtpAccount) =>
    account.CanManageKey === true || Number(account.CanManageKey) === 1;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: SmtpAccount[] }>>(
        'customer-portal/smtp/accounts',
      );
      this.accounts.set(response.data?.items ?? []);
      this.error.set(false);
      const open = this.open();
      if (open && !this.accounts().some((account) => account.HsaUUID === open)) {
        this.open.set(null);
      } else if (open) {
        await this.loadMessages(open);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(account: SmtpAccount): Promise<void> {
    if (this.open() === account.HsaUUID) {
      this.open.set(null);
      return;
    }
    this.open.set(account.HsaUUID);
    await this.loadMessages(account.HsaUUID);
  }

  askKey(account: SmtpAccount): void {
    this.closeKey();
    this.keyError.set(null);
    this.confirming.set(account.HsaUUID);
  }

  cancelKey(): void {
    this.confirming.set(null);
  }

  async generateKey(account: SmtpAccount): Promise<void> {
    if (!this.canManage(account)) return;
    this.confirming.set(null);
    this.keyError.set(null);
    try {
      const response = await this.api.post<ApiEnvelope<SmtpSendKey>>(
        `customer-portal/smtp/accounts/${account.HsaUUID}/send-key`,
      );
      if (!response.data?.sendKey) throw new Error('empty');
      this.newKey.set(response.data);
      this.newKeyFor.set(account.HsaUUID);
      this.accounts.update((list) =>
        list.map((item) =>
          item.HsaUUID === account.HsaUUID
            ? {
                ...item,
                SendKeyPrefix: response.data.prefix,
                SendKeyCreatedAt: response.data.createdAt,
              }
            : item,
        ),
      );
    } catch {
      this.keyError.set(account.HsaUUID);
    }
  }

  async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(value);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  closeKey(): void {
    this.newKey.set(null);
    this.newKeyFor.set(null);
    this.copied.set(false);
  }

  private async loadMessages(uuid: string): Promise<void> {
    this.messagesLoading.set(true);
    this.messagesError.set(false);
    this.messages.set([]);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: SmtpMessage[] }>>(
        `customer-portal/smtp/accounts/${uuid}/messages`,
      );
      if (this.open() === uuid) this.messages.set(response.data?.items ?? []);
    } catch {
      if (this.open() === uuid) this.messagesError.set(true);
    } finally {
      this.messagesLoading.set(false);
    }
  }
}
