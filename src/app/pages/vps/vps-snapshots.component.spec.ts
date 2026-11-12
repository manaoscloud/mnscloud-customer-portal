import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiError, ApiService } from '../../services/api.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import { VpsSnapshotsComponent } from './vps-snapshots.component';
import { VpsMetricsComponent } from './vps-metrics.component';
import {
  chartPath,
  metricLine,
  metricValue,
  snapshotBusy,
  snapshotState,
  type VpsServer,
  type VpsSnapshot,
  type VpsSnapshotList,
} from './vps.model';

const SERVER = { HviUUID: 'vps-1', HviName: 'WEB01', Provisioned: 1 } as VpsServer;
const READY: VpsSnapshot = {
  HvsUUID: 'snap-1',
  HvsName: 'before-update',
  HvsStatus: 'available',
  SizeGb: 40,
  DateCreated: '2026-11-12 10:00:00',
  DateCompleted: null,
};
const LIST: VpsSnapshotList = {
  items: [READY],
  canManage: 1,
  activeCount: 1,
  limit: 3,
  capabilities: { create: true, restore: true },
};

describe('VPS metrics and snapshot helpers', () => {
  it('reads the first reported series and formats values', () => {
    const items = [
      {
        metricKey: 'vps.bandwidth.inbound',
        unit: 'bytes/s',
        bucketEpoch: 2,
        average: 2048,
        minimum: 0,
        maximum: 0,
      },
      {
        metricKey: 'vps.bandwidth.inbound',
        unit: 'bytes/s',
        bucketEpoch: 1,
        average: 1024,
        minimum: 0,
        maximum: 0,
      },
    ];
    expect(metricLine(items, ['vps.network.inbound', 'vps.bandwidth.inbound'])).toEqual({
      unit: 'bytes/s',
      points: [
        { x: 1, y: 1024 },
        { x: 2, y: 2048 },
      ],
    });
    expect(metricLine(items, ['vps.cpu.usage_percent'])).toBeNull();
    expect(
      chartPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 50 },
        ],
        100,
        100,
        0,
        10,
        100,
      ),
    ).toBe('M0.0 100.0 L100.0 50.0');
    expect(metricValue(42, '%')).toBe('42.0%');
    expect(metricValue(1536, 'bytes/s')).toBe('1.5 KB/s');
    expect(metricValue(null, '%')).toBe('—');
  });

  it('maps snapshot states', () => {
    expect(snapshotState(READY)).toBe('available');
    expect(snapshotState({ ...READY, HvsStatus: 'restoring' })).toBe('restoring');
    expect(snapshotState({ ...READY, HvsStatus: 'queue_failed' })).toBe('failed');
    expect(snapshotBusy({ ...READY, HvsStatus: 'deleting' })).toBe(true);
    expect(snapshotBusy(READY)).toBe(false);
  });
});

describe('VPS portal panels', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;
  let apiDelete: ReturnType<typeof vi.fn>;
  let snack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn().mockResolvedValue({ data: LIST });
    apiPost = vi.fn().mockResolvedValue({ status: 'success', data: {} });
    apiDelete = vi.fn().mockResolvedValue({ status: 'success', data: {} });
    snack = vi.fn();
    TestBed.configureTestingModule({
      imports: [
        VpsSnapshotsComponent,
        VpsMetricsComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: ApiService, useValue: { get: apiGet, post: apiPost, delete: apiDelete } },
        { provide: PortalI18nService, useValue: { t: (key: string) => key } },
        { provide: MatSnackBar, useValue: { open: snack } },
      ],
    });
  });

  function snapshots() {
    const fixture = TestBed.createComponent(VpsSnapshotsComponent);
    fixture.componentRef.setInput('server', SERVER);
    return fixture;
  }

  it('lists snapshots with create, restore and delete for a manager', async () => {
    const fixture = snapshots();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(apiGet).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/snapshots');
    expect(text).toContain('before-update');
    expect(text).toContain('Create snapshot');
    expect(text).toContain('Restore');
    expect(text).toContain('Delete');
  });

  it('hides writes for a reader and creation at the limit', async () => {
    apiGet.mockResolvedValue({ data: { ...LIST, canManage: 0 } });
    const reader = snapshots();
    await reader.componentInstance.load();
    reader.detectChanges();
    expect(reader.nativeElement.textContent).not.toContain('Create snapshot');
    expect(reader.nativeElement.textContent).not.toContain('Restore');

    apiGet.mockResolvedValue({
      data: { ...LIST, activeCount: 3, capabilities: { create: true, restore: false } },
    });
    const full = snapshots();
    await full.componentInstance.load();
    full.detectChanges();
    expect(full.componentInstance.canCreate()).toBe(false);
    expect(full.componentInstance.canRestore(READY)).toBe(false);
  });

  it('creates, restores and deletes through the portal API and maps refusals', async () => {
    const fixture = snapshots();
    const panel = fixture.componentInstance;
    await panel.load();
    panel.name.set('  nightly  ');
    await panel.create();
    expect(apiPost).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/snapshots', {
      name: 'nightly',
    });
    await panel.run(READY, 'restore');
    expect(apiPost).toHaveBeenCalledWith(
      'customer-portal/vps/instances/vps-1/snapshots/snap-1/restore',
      {},
    );
    await panel.run(READY, 'delete');
    expect(apiDelete).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/snapshots/snap-1');
    apiPost.mockRejectedValueOnce(new ApiError('limit', 409, 'VPS_SNAPSHOT_LIMIT'));
    panel.name.set('another');
    await panel.create();
    expect(snack).toHaveBeenLastCalledWith('vps.snapshots.limitReached', 'common.ok', {
      duration: 6000,
    });
  });

  it('refuses an invalid snapshot name without calling the API', async () => {
    const panel = snapshots().componentInstance;
    await panel.load();
    panel.name.set('bad;name');
    await panel.create();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('draws the charts the server reports', async () => {
    apiGet.mockResolvedValue({
      data: {
        metrics: {
          supported: true,
          windowHours: 24,
          collectedAt: null,
          items: [
            {
              metricKey: 'vps.cpu.usage_percent',
              unit: '%',
              bucketEpoch: 1,
              average: 10,
              minimum: 5,
              maximum: 20,
            },
            {
              metricKey: 'vps.cpu.usage_percent',
              unit: '%',
              bucketEpoch: 2,
              average: 30,
              minimum: 5,
              maximum: 40,
            },
          ],
        },
      },
    });
    const fixture = TestBed.createComponent(VpsMetricsComponent);
    fixture.componentRef.setInput('server', SERVER);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(apiGet).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/metrics?hours=24');
    expect(fixture.componentInstance.charts().map((chart) => chart.key)).toEqual(['cpu']);
    expect(fixture.nativeElement.textContent).toContain('30.0%');
    fixture.componentInstance.select(168);
    expect(apiGet).toHaveBeenLastCalledWith(
      'customer-portal/vps/instances/vps-1/metrics?hours=168',
    );
  });
});
