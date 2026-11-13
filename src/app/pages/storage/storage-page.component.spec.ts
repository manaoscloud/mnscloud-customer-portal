import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiService } from '../../services/api.service';
import { StoragePageComponent } from './storage-page.component';
import {
  bucketState,
  sizeLabel,
  usagePercent,
  type StorageAccount,
  type StorageBucket,
} from './storage.model';

const ACCOUNT: StorageAccount = {
  HsaUUID: 'acc-1',
  HsaName: 'BACKUPS',
  BucketCount: 1,
  UsedBytes: 1572864,
  MeasuredAt: null,
  DateCreated: null,
};
const BUCKET: StorageBucket = {
  HsbUUID: 'b-1',
  HsbName: 'BACKUPS-DAILY',
  State: 'ready',
  UsedBytes: 1572864,
  LimitBytes: 10485760,
  MeasuredAt: null,
  DateCreated: null,
};

describe('storage model', () => {
  it('formats sizes, usage and states', () => {
    expect(sizeLabel(0)).toBe('0 B');
    expect(sizeLabel(1572864)).toBe('1.5 MB');
    expect(sizeLabel(1073741824)).toBe('1 GB');
    expect(sizeLabel(null)).toBeNull();
    expect(usagePercent(BUCKET)).toBe(15);
    expect(usagePercent({ UsedBytes: 5, LimitBytes: null })).toBeNull();
    expect(usagePercent({ UsedBytes: 50, LimitBytes: 10 })).toBe(100);
    expect(bucketState({ State: 'provisioning' })).toBe('pending');
    expect(bucketState({ State: 'ready' })).toBe('ready');
    expect(bucketState({ State: 'failed' })).toBe('failed');
  });
});

describe('StoragePageComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn((path: string) =>
      Promise.resolve({ data: { items: path.endsWith('/buckets') ? [BUCKET] : [ACCOUNT] } }),
    );
    TestBed.configureTestingModule({
      imports: [
        StoragePageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: ApiService, useValue: { get: apiGet } }],
    });
  });

  it('lists the published accounts and opens the buckets of one', async () => {
    const fixture = TestBed.createComponent(StoragePageComponent);
    const page = fixture.componentInstance;
    await page.load();
    fixture.detectChanges();
    expect(apiGet).toHaveBeenCalledWith('customer-portal/storage/accounts');
    expect(fixture.nativeElement.textContent).toContain('BACKUPS');
    await page.toggle(ACCOUNT);
    fixture.detectChanges();
    const text = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(apiGet).toHaveBeenCalledWith('customer-portal/storage/accounts/acc-1/buckets');
    expect(text).toContain('BACKUPS-DAILY');
    expect(text).toContain('1.5 MB / 10 MB');
    expect(text).toContain('Ready');
    await page.toggle(ACCOUNT);
    expect(page.open()).toBeNull();
  });

  it('shows the empty state when nothing is published', async () => {
    apiGet.mockResolvedValue({ data: { items: [] } });
    const fixture = TestBed.createComponent(StoragePageComponent);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No storage account available');
  });

  it('shows an error when the buckets cannot be read', async () => {
    const fixture = TestBed.createComponent(StoragePageComponent);
    const page = fixture.componentInstance;
    await page.load();
    apiGet.mockRejectedValueOnce(new Error('down'));
    await page.toggle(ACCOUNT);
    expect(page.bucketsError()).toBe(true);
  });
});
