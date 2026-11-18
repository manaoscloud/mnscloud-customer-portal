import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  canDecide,
  decisionValid,
  riskKey,
  sessionState,
  type Decision,
  type ManagedApproval,
  type ManagedDevice,
  type ManagedSession,
} from './managed-support.model';

/** Managed support of the customer: changes awaiting approval, devices and sessions (ST-J2b). */
@Component({
  selector: 'mcp-managed-support-page',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'managedSupport.title' | transloco }}</h1>
          <p>{{ 'managedSupport.description' | transloco }}</p>
        </div>
        <button matButton="outlined" type="button" (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          {{ 'managedSupport.refresh' | transloco }}
        </button>
      </header>

      @if (error()) {
        <p class="card notice" role="alert">{{ 'managedSupport.error' | transloco }}</p>
      }

      @if (approvals().length > 0) {
        <h2 class="block-title">{{ 'managedSupport.approvals' | transloco }}</h2>
        <div class="list">
          @for (approval of approvals(); track approval.SrpUUID) {
            <article class="card item approval">
              <div class="row">
                <strong>{{ approval.SrpTitle }}</strong>
                <span class="state" [attr.data-tone]="risk(approval) === 'high' ? 'bad' : 'warn'">
                  {{ 'managedSupport.risk.' + risk(approval) | transloco }}
                </span>
              </div>
              <p class="hint">
                {{ approval.DeviceName }} · {{ 'managedSupport.expires' | transloco }}
                {{ approval.SrpExpiresAt | date: 'short' }}
              </p>
              <p>{{ approval.SrpJustification }}</p>
              @if (approval.TechnicianNote) {
                <p class="hint">
                  {{ 'managedSupport.technicianNote' | transloco }}: {{ approval.TechnicianNote }}
                </p>
              }
              <details>
                <summary>{{ 'managedSupport.commands' | transloco }}</summary>
                <pre>{{ approval.SrpCommands.join('\\n') }}</pre>
                <p class="hint">{{ 'managedSupport.rollback' | transloco }}</p>
              </details>
              @if (can(approval)) {
                <mat-form-field appearance="outline" class="note">
                  <mat-label>{{ 'managedSupport.note' | transloco }}</mat-label>
                  <textarea
                    matInput
                    rows="2"
                    maxlength="500"
                    [ngModel]="notes()[approval.SrpUUID] ?? ''"
                    (ngModelChange)="setNote(approval, $event)"
                  ></textarea>
                  <mat-hint>{{ 'managedSupport.noteHint' | transloco }}</mat-hint>
                </mat-form-field>
                @if (failure() === approval.SrpUUID) {
                  <p class="hint" role="alert">{{ failureKey() | transloco }}</p>
                }
                <div class="actions">
                  <button
                    matButton="filled"
                    type="button"
                    [disabled]="busy() === approval.SrpUUID"
                    (click)="decide(approval, 'approve')"
                  >
                    <mat-icon>check</mat-icon>
                    {{ 'managedSupport.approve' | transloco }}
                  </button>
                  <button
                    matButton="outlined"
                    type="button"
                    [disabled]="busy() === approval.SrpUUID"
                    (click)="decide(approval, 'reject')"
                  >
                    <mat-icon>close</mat-icon>
                    {{ 'managedSupport.reject' | transloco }}
                  </button>
                </div>
              } @else {
                <p class="hint">{{ 'managedSupport.noDecision' | transloco }}</p>
              }
            </article>
          }
        </div>
      }

      <h2 class="block-title">{{ 'managedSupport.devices' | transloco }}</h2>
      @if (loading() && devices().length === 0) {
        <p role="status">{{ 'managedSupport.loading' | transloco }}</p>
      } @else if (devices().length === 0) {
        <div class="card empty-state">
          <mat-icon>router</mat-icon>
          <p>{{ 'managedSupport.emptyDevices' | transloco }}</p>
        </div>
      } @else {
        <div class="list">
          @for (device of devices(); track device.NwdUUID) {
            <article class="card item">
              <div class="row">
                <strong>{{ device.NwdName }}</strong>
                @if (device.PendingApprovals > 0) {
                  <span class="state" data-tone="warn">{{
                    'managedSupport.pending' | transloco: { count: device.PendingApprovals }
                  }}</span>
                }
              </div>
              <p class="hint">
                {{ device.SiteName }} · {{ device.NwdModel || device.NwdVendorType }}
              </p>
              @if (device.LastSessionAt) {
                <p class="hint">
                  {{ 'managedSupport.lastSession' | transloco }}
                  {{ device.LastSessionAt | date: 'short' }}
                </p>
              }
            </article>
          }
        </div>
      }

      @if (sessionsAllowed()) {
        <h2 class="block-title">{{ 'managedSupport.sessions' | transloco }}</h2>
        @if (sessions().length === 0) {
          <p class="hint">{{ 'managedSupport.emptySessions' | transloco }}</p>
        } @else {
          <div class="list">
            @for (session of sessions(); track session.SrsUUID) {
              <article class="card item">
                <div class="row">
                  <strong>{{ session.SrsTitle }}</strong>
                  <span
                    class="state"
                    [attr.data-tone]="state(session) === 'closed' ? 'ok' : 'warn'"
                  >
                    {{ 'managedSupport.state.' + state(session) | transloco }}
                  </span>
                </div>
                <p class="hint">
                  {{ session.SrsDateCreated | date: 'short' }}
                  @if (session.Devices?.length) {
                    · {{ session.Devices!.join(', ') }}
                  }
                  ·
                  {{
                    'managedSupport.appliedChanges' | transloco: { count: session.AppliedChanges }
                  }}
                </p>
              </article>
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .notice {
      padding: 16px;
    }
    .block-title {
      margin: 8px 0 0;
      font-size: 17px;
      font-weight: 650;
    }
    .list {
      display: grid;
      gap: 12px;
    }
    .item {
      display: grid;
      gap: 8px;
      padding: 16px 20px;
    }
    .item p {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px 12px;
    }
    .hint {
      color: var(--muted);
      font-size: 13px;
    }
    .note {
      width: 100%;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    details summary {
      cursor: pointer;
      font-weight: 600;
    }
    pre {
      margin: 8px 0;
      padding: 12px;
      overflow-x: auto;
      border-radius: 12px;
      font-size: 12px;
      background: var(--mat-sys-surface-container);
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
    .state[data-tone='warn'] {
      color: var(--mat-sys-on-secondary-container);
      background: var(--mat-sys-secondary-container);
    }
    .state[data-tone='bad'] {
      color: var(--mat-sys-on-error-container);
      background: var(--mat-sys-error-container);
    }
  `,
})
export class ManagedSupportPageComponent {
  private readonly api = inject(ApiService);
  readonly devices = signal<ManagedDevice[]>([]);
  readonly sessions = signal<ManagedSession[]>([]);
  readonly approvals = signal<ManagedApproval[]>([]);
  readonly sessionsAllowed = signal(false);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly busy = signal<string | null>(null);
  readonly failure = signal<string | null>(null);
  readonly failureKey = signal('managedSupport.decisionError');
  readonly notes = signal<Record<string, string>>({});

  readonly can = canDecide;
  readonly risk = riskKey;
  readonly state = sessionState;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [devices, approvals] = await Promise.all([
        this.api.get<ApiEnvelope<{ items: ManagedDevice[] }>>(
          'customer-portal/managed-support/devices',
        ),
        this.api.get<ApiEnvelope<{ items: ManagedApproval[] }>>(
          'customer-portal/managed-support/approvals',
        ),
      ]);
      this.devices.set(devices.data?.items ?? []);
      this.approvals.set(approvals.data?.items ?? []);
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
    // Sessions need their own rule: a refusal only hides the block.
    try {
      const sessions = await this.api.get<ApiEnvelope<{ items: ManagedSession[] }>>(
        'customer-portal/managed-support/sessions',
      );
      this.sessions.set(sessions.data?.items ?? []);
      this.sessionsAllowed.set(true);
    } catch {
      this.sessionsAllowed.set(false);
    }
  }

  setNote(approval: ManagedApproval, value: string): void {
    this.notes.update((all) => ({ ...all, [approval.SrpUUID]: value }));
  }

  async decide(approval: ManagedApproval, decision: Decision): Promise<void> {
    const note = this.notes()[approval.SrpUUID] ?? '';
    this.failure.set(null);
    if (!decisionValid(decision, note)) {
      this.failureKey.set('managedSupport.noteRequired');
      this.failure.set(approval.SrpUUID);
      return;
    }
    this.busy.set(approval.SrpUUID);
    try {
      await this.api.post(
        `customer-portal/managed-support/approvals/${approval.SrpUUID}/decision`,
        {
          decision,
          note: note.trim() || null,
          revision: approval.SrpRevision,
        },
      );
      await this.load();
    } catch {
      this.failureKey.set('managedSupport.decisionError');
      this.failure.set(approval.SrpUUID);
    } finally {
      this.busy.set(null);
    }
  }
}
