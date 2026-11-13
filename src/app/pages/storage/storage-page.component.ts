import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  bucketState,
  sizeLabel,
  type StorageAccount,
  type StorageBucket,
  usagePercent,
} from './storage.model';

/** Storage accounts the tenant published for the customer and their buckets (V4, read-only). */
@Component({
  selector: 'mcp-storage-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'storage.title' | transloco }}</h1>
          <p>{{ 'storage.description' | transloco }}</p>
        </div>
        <button matButton="outlined" type="button" (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          {{ 'storage.refresh' | transloco }}
        </button>
      </header>

      @if (error()) {
        <p class="card notice" role="alert">{{ 'storage.error' | transloco }}</p>
      } @else if (loading() && accounts().length === 0) {
        <p role="status">{{ 'storage.loading' | transloco }}</p>
      } @else if (accounts().length === 0) {
        <div class="card empty-state">
          <mat-icon>cloud</mat-icon>
          <p>{{ 'storage.empty' | transloco }}</p>
        </div>
      }

      <div class="accounts">
        @for (account of accounts(); track account.HsaUUID) {
          <article class="card account">
            <div class="head">
              <span class="icon-badge"><mat-icon>cloud</mat-icon></span>
              <div class="name">
                <h2>{{ account.HsaName }}</h2>
                <small>
                  {{ 'storage.bucketCount' | transloco: { count: account.BucketCount } }}
                  · {{ size(account.UsedBytes) ?? '0 B' }}
                </small>
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
                {{ 'storage.buckets' | transloco }}
              </button>
            </div>
            @if (account.MeasuredAt) {
              <p class="hint">
                {{ 'storage.measuredAt' | transloco }} {{ account.MeasuredAt | date: 'short' }}
              </p>
            }

            @if (open() === account.HsaUUID) {
              @if (bucketsError()) {
                <p class="hint" role="alert">{{ 'storage.bucketsError' | transloco }}</p>
              } @else if (bucketsLoading()) {
                <p class="hint" role="status">{{ 'storage.loading' | transloco }}</p>
              } @else if (buckets().length === 0) {
                <p class="hint">{{ 'storage.noBuckets' | transloco }}</p>
              } @else {
                <ul class="buckets">
                  @for (bucket of buckets(); track bucket.HsbUUID) {
                    <li>
                      <div class="row">
                        <code class="bucket-name">{{ bucket.HsbName }}</code>
                        <span class="state" [attr.data-state]="state(bucket)">
                          {{ 'storage.state.' + state(bucket) | transloco }}
                        </span>
                      </div>
                      <div class="row usage">
                        <span>
                          {{ size(bucket.UsedBytes) ?? ('storage.notMeasured' | transloco) }}
                          @if (size(bucket.LimitBytes); as limit) {
                            / {{ limit }}
                          } @else {
                            · {{ 'storage.noLimit' | transloco }}
                          }
                        </span>
                        @if (percent(bucket); as value) {
                          <span>{{ value }}%</span>
                        }
                      </div>
                      @if (percent(bucket) !== null) {
                        <div
                          class="bar"
                          role="progressbar"
                          [attr.aria-valuenow]="percent(bucket)"
                          aria-valuemin="0"
                          aria-valuemax="100"
                          [attr.aria-label]="'storage.usage' | transloco"
                        >
                          <span [style.width.%]="percent(bucket)"></span>
                        </div>
                      }
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
    .account {
      display: grid;
      gap: 12px;
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
    .hint {
      color: var(--muted);
    }
    .hint {
      margin: 0;
      font-size: 13px;
    }
    .buckets {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .buckets li {
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
    .bucket-name {
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
    .state[data-state='ready'] {
      color: var(--mat-sys-on-primary-container);
      background: var(--mat-sys-primary-container);
    }
    .state[data-state='failed'] {
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
export class StoragePageComponent {
  private readonly api = inject(ApiService);
  readonly accounts = signal<StorageAccount[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly open = signal<string | null>(null);
  readonly buckets = signal<StorageBucket[]>([]);
  readonly bucketsLoading = signal(false);
  readonly bucketsError = signal(false);

  readonly state = bucketState;
  readonly size = sizeLabel;
  readonly percent = usagePercent;

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: StorageAccount[] }>>(
        'customer-portal/storage/accounts',
      );
      this.accounts.set(response.data?.items ?? []);
      this.error.set(false);
      const open = this.open();
      if (open && !this.accounts().some((account) => account.HsaUUID === open)) {
        this.open.set(null);
      } else if (open) {
        await this.loadBuckets(open);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(account: StorageAccount): Promise<void> {
    if (this.open() === account.HsaUUID) {
      this.open.set(null);
      return;
    }
    this.open.set(account.HsaUUID);
    await this.loadBuckets(account.HsaUUID);
  }

  private async loadBuckets(uuid: string): Promise<void> {
    this.bucketsLoading.set(true);
    this.bucketsError.set(false);
    this.buckets.set([]);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: StorageBucket[] }>>(
        `customer-portal/storage/accounts/${uuid}/buckets`,
      );
      if (this.open() === uuid) this.buckets.set(response.data?.items ?? []);
    } catch {
      if (this.open() === uuid) this.bucketsError.set(true);
    } finally {
      this.bucketsLoading.set(false);
    }
  }
}
