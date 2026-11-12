import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiError, ApiService } from '../../services/api.service';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import { parsePorts, VpsNetworkComponent } from './vps-network.component';
import {
  blocksAllInbound,
  parseSources,
  ruleTraffic,
  type VpsFirewallRule,
  type VpsNetwork,
  type VpsServer,
} from './vps.model';

const SERVER = { HviUUID: 'vps-1', HviName: 'WEB01', Provisioned: 1 } as VpsServer;
const SSH: VpsFirewallRule = {
  Direction: 'in',
  Action: 'allow',
  Protocol: 'tcp',
  PortFrom: 22,
  PortTo: null,
  RemoteCidrs: ['0.0.0.0/0', '::/0'],
  RemoteNetworkCount: 0,
  Priority: 10,
  Comment: 'SSH',
};
const NETWORK: VpsNetwork = {
  publicIps: [{ HpiUUID: 'ip-1', Address: '203.0.113.10', PtrName: null }],
  firewalls: [
    {
      HvfUUID: 'fw-1',
      Name: 'PORTAL WEB01',
      Managed: 1,
      Status: 'applied',
      Pending: 0,
      OutboundPolicy: 'accept',
      Rules: [SSH],
    },
    {
      HvfUUID: 'fw-2',
      Name: 'SHARED',
      Managed: 0,
      Status: 'applied',
      Pending: 0,
      OutboundPolicy: 'accept',
      Rules: [SSH],
    },
  ],
  canNetwork: 1,
  canFirewall: 1,
  firewall: { maxRules: 2, outbound: true, deny: true, icmpv6: true },
};

describe('VPS network helpers', () => {
  it('parses ports and sources and describes traffic', () => {
    expect(parsePorts('443')).toEqual({ from: 443, to: null });
    expect(parsePorts('1000-2000')).toEqual({ from: 1000, to: 2000 });
    expect(parsePorts('')).toEqual({ from: null, to: null });
    expect(parsePorts('70000')).toBeNull();
    expect(parsePorts('200-100')).toBeNull();
    expect(parseSources(' 203.0.113.0/24, ::/0 ')).toEqual(['203.0.113.0/24', '::/0']);
    expect(parseSources('')).toEqual(['0.0.0.0/0', '::/0']);
    expect(ruleTraffic(SSH)).toBe('TCP 22');
    expect(ruleTraffic({ Protocol: 'udp', PortFrom: 1, PortTo: 65535 })).toBe('UDP 1-65535');
    expect(blocksAllInbound([])).toBe(true);
    expect(blocksAllInbound([SSH])).toBe(false);
  });
});

describe('VpsNetworkComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPut: ReturnType<typeof vi.fn>;
  let snack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn().mockResolvedValue({ data: NETWORK });
    apiPut = vi.fn().mockResolvedValue({ status: 'success', data: {} });
    snack = vi.fn();
    TestBed.configureTestingModule({
      imports: [
        VpsNetworkComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: ApiService, useValue: { get: apiGet, put: apiPut } },
        { provide: PortalI18nService, useValue: { t: (key: string) => key } },
        { provide: MatSnackBar, useValue: { open: snack } },
      ],
    });
  });

  function panel() {
    const fixture = TestBed.createComponent(VpsNetworkComponent);
    fixture.componentRef.setInput('server', SERVER);
    return fixture;
  }

  it('shows reverse DNS and firewalls; only the dedicated profile is editable', async () => {
    const fixture = panel();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(apiGet).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/network');
    expect(text).toContain('203.0.113.10');
    expect(text).toContain('Default name');
    expect(text).toContain('PORTAL WEB01');
    expect(text).toContain('Managed by your provider');
    expect(fixture.componentInstance.editable(NETWORK.firewalls[0])).toBe(true);
    expect(fixture.componentInstance.editable(NETWORK.firewalls[1])).toBe(false);
  });

  it('adds and removes rules and applies the whole set', async () => {
    const component = panel().componentInstance;
    await component.load();
    component.patch({ protocol: 'tcp', ports: '443', sources: '' });
    component.addRule();
    expect(component.currentRules().length).toBe(2);
    expect(component.atLimit()).toBe(true);
    await component.saveRules();
    expect(apiPut).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/firewall', {
      rules: [
        expect.objectContaining({ protocol: 'tcp', portFrom: 22 }),
        expect.objectContaining({
          protocol: 'tcp',
          portFrom: 443,
          remoteCidrs: ['0.0.0.0/0', '::/0'],
        }),
      ],
    });
    component.removeRule(0);
    component.removeRule(0);
    expect(component.closesEverything()).toBe(true);
  });

  it('saves the reverse DNS and maps refusals', async () => {
    const component = panel().componentInstance;
    await component.load();
    component.editPtr('ip-1', null);
    component.ptrDraft.set(' mail.example.com ');
    await component.savePtr('ip-1');
    expect(apiPut).toHaveBeenCalledWith('customer-portal/vps/instances/vps-1/public-ips/ip-1/ptr', {
      ptrName: 'mail.example.com',
    });
    apiPut.mockRejectedValueOnce(new ApiError('busy', 409, 'VPS_OPERATION_IN_PROGRESS'));
    await component.saveRules();
    expect(snack).toHaveBeenLastCalledWith('vps.operationInProgress', 'common.ok', {
      duration: 6000,
    });
  });
});
