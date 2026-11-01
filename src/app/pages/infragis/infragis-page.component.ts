import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import type { Box, FeatureCollection, PortalMap } from './infragis-map';
import type { InfraGisMapConfig } from './map-config';

export type InfraGisAccount = {
  IgcUUID: string;
  IgcName: string;
  ProjectsCount: number;
  AssetsCount: number;
};

export type InfraGisAsset = {
  IgaUUID: string;
  IgaName: string;
  IgaExternalID: string | null;
  ProjectName: string | null;
  LayerName: string | null;
  AssetTypeName: string | null;
  AssetStatusName: string | null;
  IgmLatitude: number | string | null;
  IgmLongitude: number | string | null;
};

type AssetPage = { items: InfraGisAsset[]; total: number; limit: number; offset: number };

export const EXPORT_FORMATS = [
  { format: 'geojson', label: 'GeoJSON', extension: 'geojson' },
  { format: 'csv', label: 'CSV', extension: 'csv' },
  { format: 'kml', label: 'KML', extension: 'kml' },
  { format: 'kmz', label: 'KMZ', extension: 'kmz' },
  { format: 'shapefile', label: 'Shapefile', extension: 'zip' },
] as const;

const PAGE = 100;

/** Without a platform map base the assets show over a plain background. */
const NO_BASE: InfraGisMapConfig = {
  provider: 'none',
  styleUrl: null,
  pmtilesUrl: null,
  attribution: null,
  centerLatitude: -14.235,
  centerLongitude: -51.9253,
  zoom: 3.5,
  accessToken: null,
};

/** File name of an export: the account name in lowercase words plus the format extension. */
export function exportFileName(account: string, extension: string): string {
  const slug = account
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `infragis-${slug || 'ativos'}.${extension}`;
}

/** Read-only view of the InfraGIS accounts the provider published to this customer. */
@Component({
  selector: 'mcp-infragis-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'infragis.title' | transloco }}</h1>
          <p>{{ 'infragis.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'infragis.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'infragis.loading' | transloco }}</p>
      } @else if (!error() && accounts().length === 0) {
        <p class="card">{{ 'infragis.empty' | transloco }}</p>
      }

      @if (accounts().length > 0) {
        <div class="accounts">
          @for (acc of accounts(); track acc.IgcUUID) {
            <button
              type="button"
              class="card account"
              [class.selected]="selected()?.IgcUUID === acc.IgcUUID"
              [attr.aria-pressed]="selected()?.IgcUUID === acc.IgcUUID"
              (click)="select(acc)"
            >
              <span class="icon-badge"><mat-icon>map</mat-icon></span>
              <span class="account-details">
                <span class="account-name">{{ acc.IgcName }}</span>
                <small>
                  {{ acc.ProjectsCount }} {{ 'infragis.projects' | transloco }} ·
                  {{ acc.AssetsCount }} {{ 'infragis.assets' | transloco }}
                </small>
              </span>
            </button>
          }
        </div>

        @if (selected(); as account) {
          <section class="assets">
            <div class="assets-header">
              <h2>{{ 'infragis.assetsOf' | transloco: { name: account.IgcName } }}</h2>
              <div class="exports" role="group" [attr.aria-label]="'infragis.export' | transloco">
                @for (option of formats; track option.format) {
                  <button
                    matButton="outlined"
                    type="button"
                    [disabled]="exporting() !== null"
                    (click)="exportAssets(option.format, option.extension)"
                  >
                    <mat-icon>download</mat-icon>{{ option.label }}
                  </button>
                }
              </div>
            </div>
            @if (exportFailed()) {
              <p class="card" role="alert">{{ 'infragis.exportError' | transloco }}</p>
            }
            <div class="views" role="group" [attr.aria-label]="'infragis.view' | transloco">
              <button
                [matButton]="view() === 'list' ? 'filled' : 'outlined'"
                type="button"
                [attr.aria-pressed]="view() === 'list'"
                (click)="showList()"
              >
                <mat-icon>list</mat-icon>{{ 'infragis.list' | transloco }}
              </button>
              <button
                [matButton]="view() === 'map' ? 'filled' : 'outlined'"
                type="button"
                [attr.aria-pressed]="view() === 'map'"
                (click)="showMap()"
              >
                <mat-icon>map</mat-icon>{{ 'infragis.map' | transloco }}
              </button>
            </div>
            @if (view() === 'map') {
              @if (mapFailed()) {
                <p class="card" role="alert">{{ 'infragis.mapError' | transloco }}</p>
              } @else if (mapNotice()) {
                <p class="hint" role="status">{{ 'infragis.' + mapNotice() | transloco }}</p>
              }
              <div
                #mapHost
                class="map-canvas card"
                role="region"
                [attr.aria-label]="'infragis.mapLabel' | transloco: { name: account.IgcName }"
              ></div>
            } @else {
              <form class="search" (submit)="$event.preventDefault(); search(query.value)">
                <input
                  #query
                  type="search"
                  [value]="term()"
                  [attr.aria-label]="'infragis.search' | transloco"
                  [placeholder]="'infragis.search' | transloco"
                />
                <button matButton="outlined" type="submit">
                  <mat-icon>search</mat-icon>{{ 'infragis.searchAction' | transloco }}
                </button>
              </form>

              @if (loadingAssets()) {
                <p role="status">{{ 'infragis.loadingAssets' | transloco }}</p>
              } @else if (assets().length === 0) {
                <p class="card">{{ 'infragis.emptyAssets' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'infragis.asset' | transloco }}</th>
                        <th scope="col">{{ 'infragis.project' | transloco }}</th>
                        <th scope="col">{{ 'infragis.layer' | transloco }}</th>
                        <th scope="col">{{ 'infragis.type' | transloco }}</th>
                        <th scope="col">{{ 'infragis.status' | transloco }}</th>
                        <th scope="col">{{ 'infragis.location' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (asset of assets(); track asset.IgaUUID) {
                        <tr>
                          <td>
                            {{ asset.IgaName }}
                            @if (asset.IgaExternalID) {
                              <small class="muted">{{ asset.IgaExternalID }}</small>
                            }
                          </td>
                          <td>{{ asset.ProjectName }}</td>
                          <td>{{ asset.LayerName }}</td>
                          <td>{{ asset.AssetTypeName }}</td>
                          <td>{{ asset.AssetStatusName }}</td>
                          <td class="mono">{{ location(asset) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <nav class="pager" [attr.aria-label]="'infragis.pages' | transloco">
                  <span>{{ offset() + 1 }}–{{ offset() + assets().length }} / {{ total() }}</span>
                  <button matButton type="button" [disabled]="offset() === 0" (click)="page(-1)">
                    <mat-icon>chevron_left</mat-icon>{{ 'infragis.previous' | transloco }}
                  </button>
                  <button
                    matButton
                    type="button"
                    [disabled]="offset() + assets().length >= total()"
                    (click)="page(1)"
                  >
                    {{ 'infragis.next' | transloco
                    }}<mat-icon iconPositionEnd>chevron_right</mat-icon>
                  </button>
                </nav>
              }
            }
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      .accounts {
        display: grid;
        gap: 12px;
        margin-bottom: 24px;
      }
      .account {
        display: flex;
        align-items: center;
        gap: 16px;
        width: 100%;
        padding: 16px 20px;
        text-align: start;
        font: inherit;
        color: inherit;
        cursor: pointer;
        border: 2px solid transparent;
      }
      .account.selected {
        border-color: var(--primary, #1976d2);
      }
      .account-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .account-name {
        font-size: 1.05rem;
        font-weight: 600;
      }
      .assets-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .assets-header h2 {
        font-size: 1.1rem;
        margin: 0;
      }
      .exports {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .search {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .search input {
        flex: 1 1 auto;
        min-width: 0;
        padding: 10px 12px;
        font: inherit;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 8px;
        background: transparent;
        color: inherit;
      }
      .table-wrap {
        overflow-x: auto;
        padding: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 10px 12px;
        text-align: start;
        border-bottom: 1px solid var(--border-color, #eee);
        white-space: nowrap;
      }
      td small {
        display: block;
      }
      .muted {
        color: var(--text-secondary, #666);
      }
      .mono {
        font-family: ui-monospace, monospace;
      }
      .views {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      .map-canvas {
        height: min(70vh, 560px);
        padding: 0;
        overflow: hidden;
      }
      .hint {
        margin: 0 0 8px;
        font-size: 0.85rem;
        color: var(--text-secondary, #666);
      }
      .pager {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
    `,
  ],
})
export class InfraGisPageComponent {
  private readonly api = inject(ApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly changes = inject(ChangeDetectorRef);
  private readonly mapHost = viewChild<ElementRef<HTMLDivElement>>('mapHost');
  private portalMap: PortalMap | null = null;
  private mapConfig: InfraGisMapConfig | null = null;
  readonly formats = EXPORT_FORMATS;
  readonly view = signal<'list' | 'map'>('list');
  readonly mapFailed = signal(false);
  /** `truncated` (more assets than shown in the area) or `emptyMap`. */
  readonly mapNotice = signal<'truncated' | 'emptyMap' | null>(null);
  readonly accounts = signal<InfraGisAccount[]>([]);
  readonly selected = signal<InfraGisAccount | null>(null);
  readonly assets = signal<InfraGisAsset[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly term = signal('');
  readonly loading = signal(false);
  readonly loadingAssets = signal(false);
  readonly exporting = signal<string | null>(null);
  readonly exportFailed = signal(false);
  readonly error = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.closeMap());
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: InfraGisAccount[] }>>(
        'customer-portal/infragis/accounts',
      );
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length > 0) await this.select(items[0]);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async select(account: InfraGisAccount) {
    this.selected.set(account);
    this.term.set('');
    this.offset.set(0);
    this.exportFailed.set(false);
    if (this.view() === 'map') await this.openMap();
    else await this.loadAssets();
  }

  showList() {
    if (this.view() === 'list') return;
    this.closeMap();
    this.view.set('list');
    void this.loadAssets();
  }

  async showMap() {
    if (this.view() === 'map') return;
    this.view.set('map');
    await this.openMap();
  }

  /** MapLibre loads only here (its own chunk), on the container rendered for the map view. */
  private async openMap() {
    this.closeMap();
    this.mapFailed.set(false);
    this.mapNotice.set(null);
    this.changes.detectChanges();
    const account = this.selected();
    const host = this.mapHost()?.nativeElement;
    if (!account || !host) return;
    try {
      if (!this.mapConfig) {
        const response = await this.api.get<ApiEnvelope<{ item: InfraGisMapConfig }>>(
          'customer-portal/infragis/map/config',
        );
        this.mapConfig = response.data?.item ?? null;
      }
      const { createPortalMap } = await import('./infragis-map');
      if (
        this.selected() !== account ||
        this.view() !== 'map' ||
        this.mapHost()?.nativeElement !== host
      ) {
        return;
      }
      this.portalMap = createPortalMap(
        host,
        this.mapConfig ?? NO_BASE,
        this.transloco.getActiveLang().slice(0, 2),
        (box) => this.features(account, box),
        (collection) =>
          this.mapNotice.set(
            collection.truncated
              ? 'truncated'
              : collection.features.length === 0
                ? 'emptyMap'
                : null,
          ),
      );
    } catch {
      this.mapFailed.set(true);
    }
  }

  private async features(account: InfraGisAccount, box: Box): Promise<FeatureCollection> {
    const query = new URLSearchParams({
      accountUUID: account.IgcUUID,
      minLng: String(box.minLng),
      minLat: String(box.minLat),
      maxLng: String(box.maxLng),
      maxLat: String(box.maxLat),
      limit: '2000',
    });
    const response = await this.api.get<ApiEnvelope<FeatureCollection>>(
      `customer-portal/infragis/map/features?${query}`,
    );
    return response.data ?? { type: 'FeatureCollection', features: [], total: 0, truncated: false };
  }

  private closeMap() {
    this.portalMap?.destroy();
    this.portalMap = null;
  }

  async search(value: string) {
    this.term.set(value.trim());
    this.offset.set(0);
    await this.loadAssets();
  }

  async page(direction: 1 | -1) {
    this.offset.set(Math.max(0, this.offset() + direction * PAGE));
    await this.loadAssets();
  }

  private async loadAssets() {
    const account = this.selected();
    if (!account) return;
    this.assets.set([]);
    this.loadingAssets.set(true);
    const query = new URLSearchParams({
      accountUUID: account.IgcUUID,
      limit: String(PAGE),
      offset: String(this.offset()),
    });
    if (this.term()) query.set('search', this.term());
    try {
      const response = await this.api.get<ApiEnvelope<AssetPage>>(
        `customer-portal/infragis/assets?${query}`,
      );
      this.assets.set(response.data?.items ?? []);
      this.total.set(response.data?.total ?? 0);
    } catch {
      this.error.set(true);
    } finally {
      this.loadingAssets.set(false);
    }
  }

  async exportAssets(format: string, extension: string) {
    const account = this.selected();
    if (!account || this.exporting()) return;
    this.exporting.set(format);
    this.exportFailed.set(false);
    try {
      const query = new URLSearchParams({ accountUUID: account.IgcUUID, format });
      const blob = await this.api.getBlob(`customer-portal/infragis/export?${query}`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = exportFileName(account.IgcName, extension);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.exportFailed.set(true);
    } finally {
      this.exporting.set(null);
    }
  }

  location(asset: InfraGisAsset): string {
    const lat = Number(asset.IgmLatitude);
    const lng = Number(asset.IgmLongitude);
    return asset.IgmLatitude === null || !Number.isFinite(lat) || !Number.isFinite(lng)
      ? '—'
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}
