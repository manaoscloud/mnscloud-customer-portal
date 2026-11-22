import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiError, ApiService } from '../../services/api.service';
import { PSK_VISIBLE_MS, VpsVpnComponent } from './vps-vpn.component';
import { bytesLabel, vpnState, type VpsVpn } from './vps.model';

const VPN: VpsVpn = {
  HvcUUID: 'vpn-1',
  HvcName: 'HQ',
  HpiAddress: '198.51.100.9',
  HvcRemoteAddress: null,
  HvcRemoteId: null,
  HvcLocalId: null,
  HvcProfile: 'recommended',
  HvcStartAction: 'responder',
  HvcMtu: 1400,
  HvcDpdSeconds: 30,
  HvcTunnelState: 'established',
  HvcDateEstablished: null,
  HvcBytesIn: 2048,
  HvcBytesOut: 0,
  HvcDateChecked: null,
  RemotePrefixes: '10.1.0.0/24, 10.2.0.0/24',
  LocalNetworkCidrs: '192.168.50.0/24',
};

describe('VpsVpnComponent', () => {
  let get: ReturnType<typeof vi.fn>;
  let post: ReturnType<typeof vi.fn>;
  let getBlob: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    get = vi.fn().mockResolvedValue({ data: { items: [VPN] } });
    post = vi.fn().mockResolvedValue({ data: { uuid: 'vpn-1', psk: 'S3cret-key' } });
    getBlob = vi.fn().mockResolvedValue(new Blob(['cfg']));
    TestBed.configureTestingModule({
      imports: [
        VpsVpnComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: ApiService, useValue: { get, post, getBlob } }],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function create() {
    const fixture = TestBed.createComponent(VpsVpnComponent);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    return fixture;
  }

  it('renders the connection details', async () => {
    const fixture = await create();
    const text = fixture.nativeElement.textContent as string;
    expect(get).toHaveBeenCalledWith('customer-portal/vps/vpn-connections');
    expect(text).toContain('HQ');
    expect(text).toContain('Connected');
    expect(text).toContain('198.51.100.9');
    expect(text).toContain('Dynamic: your device starts the tunnel');
    expect(text).toContain('10.2.0.0/24');
    expect(text).toContain('192.168.50.0/24');
    expect(text).toContain('2.0 KB');
  });

  it('hides the section when empty or refused', async () => {
    get.mockResolvedValue({ data: { items: [] } });
    let fixture = await create();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    get.mockRejectedValue(new ApiError('no', 404));
    fixture = await create();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('labels the tunnel states', () => {
    expect(vpnState({ ...VPN, HvcTunnelState: 'connecting' })).toBe('connecting');
    expect(vpnState({ ...VPN, HvcTunnelState: null })).toBe('down');
    expect(bytesLabel(null)).toBe('0 B');
  });

  it('reveals the key masked, shows it and hides it again', async () => {
    const fixture = await create();
    const cmp = fixture.componentInstance;
    await cmp.reveal(VPN);
    fixture.detectChanges();
    expect(post).toHaveBeenCalledWith('customer-portal/vps/vpn-connections/vpn-1/psk/reveal');
    expect(fixture.nativeElement.textContent).not.toContain('S3cret-key');
    cmp.toggleShown();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('S3cret-key');
    vi.advanceTimersByTime(PSK_VISIBLE_MS);
    fixture.detectChanges();
    expect(cmp.revealed()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('S3cret-key');
  });

  it('keeps no key when the reveal is refused', async () => {
    post.mockRejectedValueOnce(new ApiError('denied', 403));
    const fixture = await create();
    await fixture.componentInstance.reveal(VPN);
    expect(fixture.componentInstance.revealed()).toBeNull();
  });

  it('downloads the configuration for the chosen vendor', async () => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fixture = await create();
    await fixture.componentInstance.download(VPN, 'mikrotik7');
    expect(getBlob).toHaveBeenCalledWith(
      'customer-portal/vps/vpn-connections/vpn-1/peer-config?vendor=mikrotik7',
    );
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
