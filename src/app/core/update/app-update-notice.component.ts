import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppUpdateService } from './app-update.service';

/** Calm, non-blocking notice shown when a newer portal release goes live while the tab is open. */
@Component({
  selector: 'mcp-app-update-notice',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (update.noticeVisible()) {
      @let critical = update.critical();
      <aside
        class="update-notice"
        [class.critical]="critical"
        role="status"
        aria-live="polite"
        [attr.aria-label]="(critical ? 'update.important' : 'update.available') | transloco"
      >
        <mat-icon class="update-icon" aria-hidden="true">{{
          critical ? 'system_update' : 'auto_awesome'
        }}</mat-icon>
        <div class="update-body">
          <p class="update-title">
            {{ (critical ? 'update.important' : 'update.available') | transloco }}
            @if (update.deployed(); as deployed) {
              <span class="update-version">v{{ deployed.version }}</span>
            }
          </p>
          <p class="update-text">
            @if (confirmOpenWork()) {
              {{ 'update.openWork' | transloco }}
            } @else if (critical) {
              {{ 'update.criticalText' | transloco }}
            } @else {
              {{ 'update.text' | transloco }}
            }
          </p>
          <div class="update-actions">
            @if (!critical) {
              <button mat-button type="button" (click)="later()">{{ 'update.later' | transloco }}</button>
            }
            <button mat-flat-button type="button" (click)="reload()">
              <mat-icon aria-hidden="true">refresh</mat-icon>
              {{ (confirmOpenWork() ? 'update.anyway' : 'update.now') | transloco }}
            </button>
          </div>
        </div>
        @if (!critical) {
          <button
            mat-icon-button
            type="button"
            class="update-close"
            [matTooltip]="'update.remindLater' | transloco"
            [attr.aria-label]="'update.remindLater' | transloco"
            (click)="later()"
          >
            <mat-icon>close</mat-icon>
          </button>
        }
      </aside>
    }
  `,
  styles: `
    .update-notice {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 900;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      width: min(380px, calc(100vw - 48px));
      box-sizing: border-box;
      padding: 16px 8px 12px 16px;
      border-radius: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
      box-shadow:
        0 6px 24px rgba(0, 0, 0, 0.14),
        0 2px 6px rgba(0, 0, 0, 0.08);
      animation: update-in 220ms ease-out;
    }
    .update-notice.critical {
      padding-right: 16px;
      border: 2px solid var(--mat-sys-primary);
    }
    .update-icon {
      flex: none;
      margin-top: 2px;
      color: var(--mat-sys-primary);
    }
    .update-body {
      flex: 1;
      min-width: 0;
    }
    .update-title {
      margin: 0;
      font-weight: 600;
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .update-version {
      margin-left: 6px;
      font-weight: 500;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .update-text {
      margin: 4px 0 0;
      font-size: 0.875rem;
      line-height: 1.45;
      color: var(--mat-sys-on-surface-variant);
    }
    .update-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    .update-close {
      flex: none;
      margin-top: -8px;
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 600px) {
      .update-notice {
        right: 8px;
        left: 8px;
        bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        width: auto;
      }
      .update-actions button {
        flex: 1 1 auto;
        min-height: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .update-notice {
        animation: none;
      }
    }
    @keyframes update-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class AppUpdateNoticeComponent {
  protected readonly update = inject(AppUpdateService);
  protected readonly confirmOpenWork = signal(false);

  constructor() {
    this.update.start();
  }

  protected reload() {
    if (this.update.hasOpenWork() && !this.confirmOpenWork()) {
      this.confirmOpenWork.set(true);
      return;
    }
    this.update.reloadNow();
  }

  protected later() {
    this.confirmOpenWork.set(false);
    this.update.postpone();
  }
}
