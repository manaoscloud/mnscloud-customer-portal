import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import {
  chartPath,
  metricLine,
  metricValue,
  VPS_METRIC_CHARTS,
  type VpsMetrics,
  type VpsMetricWindow,
  type VpsServer,
} from './vps.model';

const WIDTH = 600;
const HEIGHT = 140;
const WINDOWS: VpsMetricWindow[] = [1, 24, 168];

type Chart = {
  key: string;
  lines: Array<{ path: string; last: string; series: 'in' | 'out' | 'value' }>;
};

/** Usage charts of one server (hand-written SVG, like the App monitor; no chart library). */
@Component({
  selector: 'mcp-vps-metrics',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'dialog', 'aria-modal': 'true', '[attr.aria-label]': 'server().HviName' },
  template: `
    <div class="frame">
      <header>
        <strong>{{ 'vps.metrics.title' | transloco }} · {{ server().HviName }}</strong>
        <div class="actions">
          <div class="windows" role="group" [attr.aria-label]="'vps.metrics.window' | transloco">
            @for (option of windows; track option) {
              <button
                type="button"
                [matButton]="hours() === option ? 'filled' : 'outlined'"
                [attr.aria-pressed]="hours() === option"
                (click)="select(option)"
              >
                {{ 'vps.metrics.hours' + option | transloco }}
              </button>
            }
          </div>
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
        <p class="notice" role="alert">{{ 'vps.metrics.error' | transloco }}</p>
      } @else if (loading() && !metrics()) {
        <p role="status">{{ 'vps.metrics.loading' | transloco }}</p>
      } @else if (charts().length === 0) {
        <p class="notice">{{ 'vps.metrics.unavailable' | transloco }}</p>
      } @else {
        <div class="charts">
          @for (chart of charts(); track chart.key) {
            <section class="chart">
              <div class="chart-head">
                <h3>{{ 'vps.metrics.' + chart.key | transloco }}</h3>
                <span class="values">
                  @for (line of chart.lines; track line.series) {
                    <span [attr.data-series]="line.series">
                      @if (line.series !== 'value') {
                        {{ 'vps.metrics.' + line.series | transloco }}
                      }
                      {{ line.last }}
                    </span>
                  }
                </span>
              </div>
              <svg
                [attr.viewBox]="'0 0 ' + width + ' ' + height"
                preserveAspectRatio="none"
                role="img"
                [attr.aria-label]="'vps.metrics.' + chart.key | transloco"
              >
                <line x1="0" [attr.y1]="height" [attr.x2]="width" [attr.y2]="height" class="axis" />
                @for (line of chart.lines; track line.series) {
                  <path [attr.d]="line.path" [attr.data-series]="line.series" />
                }
              </svg>
            </section>
          }
        </div>
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
      gap: 14px;
      width: min(960px, 100%);
      max-height: 100%;
      overflow: auto;
      padding: 16px;
      border-radius: var(--radius, 12px);
      background: var(--surface);
    }
    header,
    .actions,
    .windows,
    .chart-head,
    .values {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    header {
      justify-content: space-between;
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .chart {
      display: grid;
      gap: 6px;
      padding: 12px;
      border-radius: var(--radius, 12px);
      background: var(--mat-sys-surface-container);
    }
    .chart-head {
      justify-content: space-between;
    }
    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .values {
      font-size: 13px;
      color: var(--muted);
    }
    svg {
      width: 100%;
      height: 120px;
    }
    path {
      fill: none;
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      stroke: var(--mat-sys-primary);
    }
    path[data-series='out'] {
      stroke: var(--mat-sys-tertiary, var(--mat-sys-secondary));
    }
    span[data-series='in'] {
      color: var(--mat-sys-primary);
    }
    span[data-series='out'] {
      color: var(--mat-sys-tertiary, var(--mat-sys-secondary));
    }
    .axis {
      stroke: var(--mat-sys-outline-variant);
      vector-effect: non-scaling-stroke;
    }
    .notice {
      margin: 0;
    }
    @media (max-width: 600px) {
      .charts {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class VpsMetricsComponent {
  private readonly api = inject(ApiService);
  readonly server = input.required<VpsServer>();
  readonly closed = output<void>();
  readonly windows = WINDOWS;
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly hours = signal<VpsMetricWindow>(24);
  readonly metrics = signal<VpsMetrics | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  /** Charts with data; percentages use 0-100, the rest scale to their peak. */
  readonly charts = computed<Chart[]>(() => {
    const metrics = this.metrics();
    if (!metrics?.supported) return [];
    const charts: Chart[] = [];
    for (const definition of VPS_METRIC_CHARTS) {
      const lines = definition.lines
        .map((keys) => metricLine(metrics.items, keys))
        .map((line, index) => ({ line, index }))
        .filter((entry) => entry.line !== null);
      if (!lines.length) continue;
      const all = lines.flatMap((entry) => entry.line!.points);
      const minX = Math.min(...all.map((p) => p.x));
      const maxX = Math.max(...all.map((p) => p.x));
      const percent = lines.every((entry) => entry.line!.unit === '%');
      const maxY = percent ? 100 : Math.max(...all.map((p) => p.y)) * 1.1;
      charts.push({
        key: definition.key,
        lines: lines.map(({ line, index }) => ({
          path: chartPath(line!.points, WIDTH, HEIGHT, minX, maxX, maxY),
          last: metricValue(line!.points[line!.points.length - 1]?.y, line!.unit),
          series: definition.lines.length > 1 ? (index === 0 ? 'in' : 'out') : 'value',
        })),
      });
    }
    return charts;
  });

  constructor() {
    queueMicrotask(() => void this.load());
  }

  select(option: VpsMetricWindow): void {
    if (this.hours() === option) return;
    this.hours.set(option);
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<{ metrics: VpsMetrics }>>(
        `customer-portal/vps/instances/${this.server().HviUUID}/metrics?hours=${this.hours()}`,
      );
      this.metrics.set(response.data?.metrics ?? null);
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
