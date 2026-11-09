import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiService } from '../../services/api.service';
import { VoipPageComponent } from './voip-page.component';

describe('VoipPageComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn().mockImplementation((path: string) => {
      if (path.includes('customer-portal/voip/accounts')) {
        return Promise.resolve({
          data: {
            items: [
              {
                VpaUUID: 'acc-1',
                VpaName: 'PABX Head Office',
                VpaKind: 'customer',
                VpaNotes: null,
                ExtensionsCount: 5,
                TrunksCount: 1,
                QueuesCount: 2,
                CreatedAt: '2026-11-05T00:00:00Z',
              },
            ],
          },
        });
      }
      if (path.includes('customer-portal/voip/extensions')) {
        return Promise.resolve({
          data: {
            items: [
              {
                VpeUUID: 'ext-1',
                VpeExtension: '1000',
                VpeName: 'Alice',
                VpeKind: 'sip',
                VpeStatus: 1,
                VpeCallerIdExternal: '+5511999990001',
                VpeCallerIdInternal: '1000',
              },
            ],
          },
        });
      }
      if (path.includes('customer-portal/voip/cdrs')) {
        return Promise.resolve({
          data: {
            items: [
              {
                VcdUUID: 'cdr-1',
                VcdDirection: 'inbound',
                VcdSource: '11988887777',
                VcdDestination: '1000',
                VcdDurationSeconds: 45,
                VcdBillsec: 42,
                VcdDisposition: 'ANSWERED',
                VcdStartTime: '2026-11-05T12:00:00Z',
                VcdEndTime: '2026-11-05T12:00:45Z',
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    TestBed.configureTestingModule({
      imports: [
        VoipPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: ApiService, useValue: { get: apiGet } }],
    });
  });

  it('loads accounts and extensions on initialization', async () => {
    const fixture = TestBed.createComponent(VoipPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadAccounts();
    fixture.detectChanges();

    expect(comp.accounts().length).toBe(1);
    expect(comp.selectedAccount()?.VpaName).toBe('PABX Head Office');
    expect(comp.extensions().length).toBe(1);
    expect(comp.extensions()[0].VpeExtension).toBe('1000');
  });

  it('switches to CDRs tab and loads call records', async () => {
    const fixture = TestBed.createComponent(VoipPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const comp = fixture.componentInstance;
    comp.setTab('cdrs');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.activeTab()).toBe('cdrs');
    expect(comp.cdrs().length).toBe(1);
    expect(comp.cdrs()[0].VcdSource).toBe('11988887777');
  });
});
