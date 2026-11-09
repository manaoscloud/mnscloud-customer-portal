import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type HrRequest = {
  RequestUUID: string;
  RequestID: string;
  Type: 'missing_punch' | 'punch_contest' | 'absence';
  Status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  EmployeeName: string;
  DepartmentName: string | null;
  Date: string;
  EndDate: string | null;
  PunchType: string | null;
  OccurredAt: string | null;
  ContestedPunchType: string | null;
  ContestedOccurredAt: string | null;
  AbsenceType: string | null;
  HasAttachment: boolean;
  AttachmentFileName: string | null;
  Reason: string;
  DecisionNote: string | null;
  CanDecide: boolean;
  MessageCount: number;
  Revision: number;
};
type Message = { MessageUUID: string; AuthorKind: string; AuthorName: string | null; Mine: boolean; Body: string; DateCreated: string | null };

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

/** Local date and time of an instant (UTC in the API). */
export function localInstant(value: string | null, locale = 'pt-BR'): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/** YYYY-MM-DD as DD/MM/YYYY. */
export function day(value: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** Pulse requests the portal user decides: approve or reject with a note, certificate and conversation. */
@Component({
  selector: 'mcp-hr-requests',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <mat-form-field>
        <mat-label>{{ 'hr.requests.status' | transloco }}</mat-label>
        <mat-select [value]="status()" (valueChange)="status.set($event); load()">
          <mat-option value="">{{ 'hr.requests.all' | transloco }}</mat-option>
          @for (item of statuses; track item) {
            <mat-option [value]="item">{{ 'hr.requests.statuses.' + item | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
    @if (failed()) {
      <p class="card" role="alert">{{ 'hr.requests.error' | transloco }}</p>
    }
    @if (items().length === 0 && !failed()) {
      <p class="card">{{ 'hr.requests.empty' | transloco }}</p>
    }
    <div class="requests">
      @for (item of items(); track item.RequestUUID) {
        <article class="card request" [class.open]="selected() === item.RequestUUID">
          <button type="button" class="summary" (click)="toggle(item)" [attr.aria-expanded]="selected() === item.RequestUUID">
            <span class="title">{{ item.EmployeeName }} · {{ 'hr.requests.types.' + item.Type | transloco }}</span>
            <span class="badge" [class]="'badge status-' + item.Status">{{ 'hr.requests.statuses.' + item.Status | transloco }}</span>
            <span class="detail">{{ detail(item) }}</span>
            @if (item.MessageCount > 0) {
              <span class="detail"><mat-icon inline>forum</mat-icon> {{ item.MessageCount }}</span>
            }
          </button>
          @if (selected() === item.RequestUUID) {
            <div class="body">
              <dl>
                <dt>{{ 'hr.requests.reason' | transloco }}</dt>
                <dd>{{ item.Reason }}</dd>
                @if (item.DepartmentName) {
                  <dt>{{ 'hr.department' | transloco }}</dt>
                  <dd>{{ item.DepartmentName }}</dd>
                }
                @if (item.DecisionNote) {
                  <dt>{{ 'hr.requests.note' | transloco }}</dt>
                  <dd>{{ item.DecisionNote }}</dd>
                }
              </dl>
              @if (item.HasAttachment) {
                <button matButton type="button" (click)="certificate(item)">
                  <mat-icon>attach_file</mat-icon>{{ item.AttachmentFileName ?? ('hr.requests.certificate' | transloco) }}
                </button>
              }

              <h3>{{ 'hr.requests.conversation' | transloco }}</h3>
              @if (messages().length === 0) {
                <p class="hint">{{ 'hr.requests.noMessages' | transloco }}</p>
              }
              <ul class="messages">
                @for (message of messages(); track message.MessageUUID) {
                  <li [class.mine]="message.Mine">
                    <span class="author">{{ message.AuthorName ?? '—' }} · {{ localInstant(message.DateCreated) }}</span>
                    <span>{{ message.Body }}</span>
                  </li>
                }
              </ul>
              @if (item.CanDecide) {
                <form class="reply" (ngSubmit)="send(item)">
                  <mat-form-field>
                    <mat-label>{{ 'hr.requests.message' | transloco }}</mat-label>
                    <textarea matInput name="message" rows="2" maxlength="2000" [(ngModel)]="message"></textarea>
                  </mat-form-field>
                  <button matButton="tonal" type="submit" [disabled]="busy() || !message.trim()">{{ 'hr.requests.send' | transloco }}</button>
                </form>
                <div class="decision">
                  <mat-form-field>
                    <mat-label>{{ 'hr.requests.noteLabel' | transloco }}</mat-label>
                    <textarea matInput name="note" rows="2" maxlength="1000" [(ngModel)]="note"></textarea>
                    <mat-hint>{{ 'hr.requests.noteHint' | transloco }}</mat-hint>
                  </mat-form-field>
                  <div class="actions">
                    <button matButton="outlined" type="button" [disabled]="busy() || !note.trim()" (click)="decide(item, 'reject')">
                      {{ 'hr.requests.reject' | transloco }}
                    </button>
                    <button matButton="filled" type="button" [disabled]="busy()" (click)="decide(item, 'approve')">
                      {{ 'hr.requests.approve' | transloco }}
                    </button>
                  </div>
                </div>
              }
              @if (feedback()) {
                <p role="status" class="feedback">{{ feedback()! | transloco }}</p>
              }
            </div>
          }
        </article>
      }
    </div>
  `,
  styles: [`
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; }
    .toolbar mat-form-field { flex: 0 1 240px; min-width: 0; }
    .requests { display: grid; gap: 12px; }
    .request { padding: 0; min-width: 0; }
    .summary { all: unset; box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; width: 100%; padding: 14px 16px; cursor: pointer; }
    .summary:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
    .title { font-weight: 600; flex: 1 1 220px; overflow-wrap: anywhere; }
    .detail { flex: 1 1 100%; color: var(--text-secondary, #555); display: inline-flex; gap: 4px; align-items: center; }
    .badge { padding: 2px 10px; border-radius: 999px; font-size: 0.8rem; background: var(--surface-container, rgba(0, 0, 0, 0.06)); }
    .status-pending { font-weight: 600; }
    .body { padding: 0 16px 16px; display: grid; gap: 8px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; }
    dt { font-weight: 600; }
    dd { margin: 0; overflow-wrap: anywhere; }
    h3 { font-size: 1rem; margin: 8px 0 0; }
    .messages { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .messages li { display: grid; gap: 2px; padding: 8px 12px; border-radius: 12px; background: var(--surface-container, rgba(0, 0, 0, 0.05)); max-width: 560px; overflow-wrap: anywhere; }
    .messages li.mine { justify-self: end; background: var(--primary-container, rgba(0, 90, 160, 0.12)); }
    .author { font-size: 0.8rem; color: var(--text-secondary, #555); }
    .reply, .decision { display: grid; gap: 8px; }
    .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .hint { margin: 0; font-size: 0.85rem; color: var(--text-secondary, #666); }
    .feedback { margin: 0; font-weight: 600; }
  `],
})
export class HrRequestsComponent {
  private readonly api = inject(ApiService);
  /** HR account of the page; reloading it resets the list. */
  readonly account = input.required<string>();
  /** Pending requests changed (decision): the page refreshes its counter. */
  readonly changed = output<void>();
  readonly statuses = STATUSES;
  readonly localInstant = localInstant;
  readonly items = signal<HrRequest[]>([]);
  readonly status = signal<string>('pending');
  readonly selected = signal<string | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly feedback = signal<string | null>(null);
  message = '';
  note = '';
  private messageUUID = crypto.randomUUID();

  constructor() {
    effect(() => {
      this.account();
      this.selected.set(null);
      void this.load();
    });
  }

  private base(): string {
    return `customer-portal/hr/accounts/${encodeURIComponent(this.account())}/requests`;
  }

  async load() {
    this.failed.set(false);
    const query = new URLSearchParams({ limit: '100' });
    if (this.status()) query.set('status', this.status());
    try {
      const response = await this.api.get<ApiEnvelope<{ items: HrRequest[] }>>(`${this.base()}?${query}`);
      this.items.set(response.data?.items ?? []);
    } catch {
      this.failed.set(true);
    }
  }

  detail(item: HrRequest): string {
    if (item.Type === 'absence') {
      const range = item.EndDate && item.EndDate !== item.Date ? `${day(item.Date)} – ${day(item.EndDate)}` : day(item.Date);
      return range;
    }
    const at = item.Type === 'missing_punch' ? item.OccurredAt : item.ContestedOccurredAt;
    return localInstant(at) || day(item.Date);
  }

  async toggle(item: HrRequest) {
    this.feedback.set(null);
    if (this.selected() === item.RequestUUID) {
      this.selected.set(null);
      return;
    }
    this.selected.set(item.RequestUUID);
    this.message = '';
    this.note = '';
    this.messageUUID = crypto.randomUUID();
    await this.loadMessages(item);
  }

  private async loadMessages(item: HrRequest) {
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Message[] }>>(`${this.base()}/${item.RequestUUID}/messages`);
      this.messages.set(response.data?.items ?? []);
    } catch {
      this.messages.set([]);
    }
  }

  async send(item: HrRequest) {
    const body = this.message.trim();
    if (!body) return;
    this.busy.set(true);
    this.feedback.set(null);
    try {
      // The same identifier on a retry: the API returns the stored message.
      await this.api.post(`${this.base()}/${item.RequestUUID}/messages`, { uuid: this.messageUUID, body });
      this.message = '';
      this.messageUUID = crypto.randomUUID();
      await this.loadMessages(item);
    } catch (error) {
      this.feedback.set(error instanceof ApiError && error.status === 400 ? 'hr.requests.closed' : 'hr.requests.error');
    } finally {
      this.busy.set(false);
    }
  }

  async decide(item: HrRequest, decision: 'approve' | 'reject') {
    this.busy.set(true);
    this.feedback.set(null);
    try {
      await this.api.put(`${this.base()}/${item.RequestUUID}`, {
        decision,
        note: this.note.trim() || null,
        revision: item.Revision,
      });
      this.feedback.set(decision === 'approve' ? 'hr.requests.approved' : 'hr.requests.rejected');
      this.changed.emit();
      await this.load();
    } catch (error) {
      this.feedback.set(error instanceof ApiError && error.status === 409 ? 'hr.requests.conflict' : 'hr.requests.error');
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  async certificate(item: HrRequest) {
    try {
      const blob = await this.api.getBlob(`${this.base()}/${item.RequestUUID}/attachment`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      this.feedback.set('hr.requests.certificateError');
    }
  }
}

