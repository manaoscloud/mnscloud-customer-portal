import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiService } from '../../services/api.service';
import { WebhostPageComponent } from './webhost-page.component';

describe('WebhostPageComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;
  let apiPut: ReturnType<typeof vi.fn>;
  let apiDelete: ReturnType<typeof vi.fn>;

  const mockHost = {
    HwhUUID: 'hwh-1',
    HwhName: 'Starter Host',
    Domain: 'acme.com',
    HwhUsername: 'acme',
    HwhStatus: 'active',
    HwhProvisionStatus: 'active',
    PlanName: 'Cloud Standard',
    DiskQuotaMb: 5000,
    BandwidthQuotaMb: 50000,
    EmailAccountsMax: 10,
    DatabasesMax: 5,
    EmailsCount: 1,
    DatabasesCount: 1,
    ServerIp: '198.51.100.10',
    Nameservers: ['ns1.acme.com', 'ns2.acme.com'],
    CanEmails: 1,
    CanDatabases: 1,
    CanDns: 1,
    HwhRevision: 'rev-1',
    CreatedAt: '2026-11-06T00:00:00Z',
  };

  const mockEmail = {
    HweUUID: 'hwe-1',
    HweLocalPart: 'contact',
    Email: 'contact@acme.com',
    HweQuotaMb: 500,
    HweStatus: 'active',
    HweProvisionStatus: 'active',
    CreatedAt: '2026-11-06T00:00:00Z',
  };

  const mockDatabaseData = {
    databases: [
      {
        HwdUUID: 'hwd-1',
        HwdName: 'acme_blog',
        HwdStatus: 'active',
        HwdProvisionStatus: 'active',
        CreatedAt: '2026-11-06T00:00:00Z',
      },
    ],
    users: [
      {
        HduUUID: 'hdu-1',
        HduName: 'acme_user',
        HduStatus: 'active',
        HduProvisionStatus: 'active',
        CreatedAt: '2026-11-06T00:00:00Z',
      },
    ],
    grants: [
      {
        HdgUUID: 'hdg-1',
        DatabaseUUID: 'hwd-1',
        DatabaseName: 'acme_blog',
        UserUUID: 'hdu-1',
        UserName: 'acme_user',
        Privileges: ['ALL'],
        HdgStatus: 'active',
        HdgProvisionStatus: 'active',
      },
    ],
  };

  const mockDnsRecord = {
    HwzUUID: 'hwz-1',
    HwzName: 'www.acme.com.',
    HwzType: 'CNAME',
    HwzValue: 'acme.com.',
    HwzPriority: null,
    HwzWeight: null,
    HwzPort: null,
    HwzTtl: 3600,
    HwzManaged: 0,
    HwzStatus: 'active',
    HwzProvisionStatus: 'active',
    CreatedAt: '2026-11-06T00:00:00Z',
  };

  beforeEach(() => {
    apiGet = vi.fn().mockImplementation((path: string) => {
      if (path.includes('customer-portal/webhost/hosts/') && path.includes('/emails')) {
        return Promise.resolve({ data: { items: [mockEmail] } });
      }
      if (path.includes('customer-portal/webhost/hosts/') && path.includes('/databases')) {
        return Promise.resolve({ data: mockDatabaseData });
      }
      if (path.includes('customer-portal/webhost/hosts/') && path.includes('/dns')) {
        return Promise.resolve({ data: { items: [mockDnsRecord] } });
      }
      if (path.includes('customer-portal/webhost/hosts')) {
        return Promise.resolve({ data: { items: [mockHost] } });
      }
      return Promise.resolve({ data: {} });
    });

    apiPost = vi.fn().mockResolvedValue({ status: 'success', data: {} });
    apiPut = vi.fn().mockResolvedValue({ status: 'success', data: {} });
    apiDelete = vi.fn().mockResolvedValue({ status: 'success', data: {} });

    TestBed.configureTestingModule({
      imports: [
        WebhostPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [
        {
          provide: ApiService,
          useValue: { get: apiGet, post: apiPost, put: apiPut, delete: apiDelete },
        },
      ],
    });
  });

  it('loads hosts and details on initialization', async () => {
    const fixture = TestBed.createComponent(WebhostPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadHosts();
    fixture.detectChanges();

    expect(comp.hosts().length).toBe(1);
    expect(comp.selectedHost()?.Domain).toBe('acme.com');
    expect(comp.emails().length).toBe(1);
    expect(comp.databases()?.databases.length).toBe(1);
    expect(comp.dnsRecords().length).toBe(1);
  });

  it('creates email account via API post', async () => {
    const fixture = TestBed.createComponent(WebhostPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadHosts();

    comp.emailLocalPart.set('sales');
    comp.emailQuotaMb.set(1000);
    comp.emailPassword.set('Secret123!');
    await comp.createEmail(mockHost);

    expect(apiPost).toHaveBeenCalledWith(
      expect.stringContaining('emails'),
      expect.objectContaining({ localPart: 'sales', quotaMb: 1000 }),
    );
    expect(comp.actionStatus()).toBe('success');
  });

  it('updates email quota via API put', async () => {
    const fixture = TestBed.createComponent(WebhostPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadHosts();

    comp.openQuotaModal(mockEmail);
    expect(comp.editingQuotaEmailUUID()).toBe('hwe-1');

    comp.editQuotaValue.set(2048);
    await comp.saveEmailQuota(mockHost, 'hwe-1');

    expect(apiPut).toHaveBeenCalledWith(
      expect.stringContaining('emails/hwe-1/quota'),
      expect.objectContaining({ quotaMb: 2048 }),
    );
    expect(comp.editingQuotaEmailUUID()).toBeNull();
  });

  it('deletes email account via API delete', async () => {
    const fixture = TestBed.createComponent(WebhostPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadHosts();

    await comp.deleteEmail(mockHost, mockEmail);

    expect(apiDelete).toHaveBeenCalledWith(expect.stringContaining('emails/hwe-1'));
    expect(comp.actionStatus()).toBe('success');
  });

  it('creates and deletes database resources', async () => {
    const fixture = TestBed.createComponent(WebhostPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadHosts();

    comp.dbName.set('shop');
    await comp.createDatabase(mockHost);
    expect(apiPost).toHaveBeenCalledWith(
      expect.stringContaining('databases'),
      expect.objectContaining({ name: 'shop' }),
    );

    await comp.deleteDatabase(mockHost, mockDatabaseData.databases[0]);
    expect(apiDelete).toHaveBeenCalledWith(expect.stringContaining('databases/hwd-1'));
  });

  it('creates and deletes DNS records', async () => {
    const fixture = TestBed.createComponent(WebhostPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadHosts();

    comp.dnsName.set('api.acme.com.');
    comp.dnsType.set('A');
    comp.dnsValue.set('198.51.100.20');
    await comp.createDnsRecord(mockHost);

    expect(apiPost).toHaveBeenCalledWith(
      expect.stringContaining('dns'),
      expect.objectContaining({ name: 'api.acme.com.', type: 'A', value: '198.51.100.20' }),
    );

    await comp.deleteDnsRecord(mockHost, mockDnsRecord);
    expect(apiDelete).toHaveBeenCalledWith(expect.stringContaining('dns/hwz-1'));
  });
});
