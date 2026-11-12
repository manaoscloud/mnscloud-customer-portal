import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiError, ApiService } from '../../services/api.service';
import { VpsPageComponent } from './vps-page.component';
import { consoleSocketUrl, termproxyInput, termproxyResize } from './vps-console.component';
import { memoryLabel, powerActions, serverState, type VpsServer } from './vps.model';

const SERVER: VpsServer = {
  HviUUID: 'vps-1',
  HviName: 'WEB01',
  HviStatus: 'running',
  Provisioned: 1,
  PowerHeld: 0,
  PlanName: 'BASIC',
  PublicIpv4: '198.51.100.7',
  PublicIpv6: null,
  PrivateIpv4: null,
  Username: 'debian',
  Vcpus: '2',
  MemoryMb: '2048',
  DiskGb: '40',
  GraphicalConsole: 1,
  CanPower: 1,
  CanConsole: 1,
  CanSnapshots: 1,
  DateCreated: null,
};

describe('VPS model', () => {
  it('offers only the actions the state and the rule allow', () => {
    expect(powerActions(SERVER)).toEqual(['reboot', 'stop']);
    expect(powerActions({ ...SERVER, HviStatus: 'stopped' })).toEqual(['start']);
    expect(powerActions({ ...SERVER, HviStatus: 'rebooting' })).toEqual([]);
    expect(powerActions({ ...SERVER, CanPower: 0 })).toEqual([]);
    expect(powerActions({ ...SERVER, PowerHeld: 1 })).toEqual([]);
    expect(serverState({ ...SERVER, PowerHeld: 1 })).toBe('held');
    expect(serverState({ ...SERVER, Provisioned: 0, HviStatus: null })).toBe('pending');
  });

  it('formats memory and console frames like the App console', () => {
    expect(memoryLabel('2048')).toBe('2 GB');
    expect(memoryLabel('512')).toBe('0.5 GB');
    expect(memoryLabel(null)).toBeNull();
    expect(termproxyInput('ã')).toBe('0:2:ã');
    expect(termproxyResize(80, 24)).toBe('1:80:24:');
    expect(
      consoleSocketUrl('https://portal.example.com/api/v1', {
        type: 'serial',
        token: 'a b',
        path: '/hosting/vps/console/ws',
      }),
    ).toBe('wss://portal.example.com/api/v1/hosting/vps/console/ws?token=a%20b');
  });
});

describe('VpsPageComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn().mockResolvedValue({ data: { items: [SERVER] } });
    apiPost = vi.fn().mockResolvedValue({
      status: 'success',
      data: { item: { ...SERVER, HviStatus: 'rebooting' } },
    });
    TestBed.configureTestingModule({
      imports: [
        VpsPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: ApiService, useValue: { get: apiGet, post: apiPost } }],
    });
  });

  it('lists the published servers with address and actions', async () => {
    const fixture = TestBed.createComponent(VpsPageComponent);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(apiGet).toHaveBeenCalledWith('customer-portal/vps/instances');
    expect(text).toContain('WEB01');
    expect(text).toContain('198.51.100.7');
    expect(text).toContain('Reboot');
    expect(text).toContain('Console');
  });

  it('queues a power action and shows the new state', async () => {
    const fixture = TestBed.createComponent(VpsPageComponent);
    const page = fixture.componentInstance;
    await page.load();
    await page.power(SERVER, 'reboot');
    expect(apiPost).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/power', {
      action: 'reboot',
    });
    expect(page.servers()[0].HviStatus).toBe('rebooting');
    expect(page.confirming()).toBeNull();
  });

  it('reloads after a refused action', async () => {
    apiPost.mockRejectedValueOnce(new ApiError('held', 409, 'VPS_POWER_BILLING_CONTROLLED'));
    const fixture = TestBed.createComponent(VpsPageComponent);
    const page = fixture.componentInstance;
    await page.load();
    apiGet.mockClear();
    await page.power(SERVER, 'stop');
    expect(apiGet).toHaveBeenCalledWith('customer-portal/vps/instances');
  });

  it('shows the empty state when nothing is published', async () => {
    apiGet.mockResolvedValue({ data: { items: [] } });
    const fixture = TestBed.createComponent(VpsPageComponent);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No server available');
  });
});
