import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import en from '../../../../public/i18n/en-US.json';
import { ApiService } from '../../services/api.service';
import { ContractsPageComponent } from './contracts-page.component';

describe('ContractsPageComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;
  let apiGetBlob: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn().mockImplementation((path: string) => {
      if (path.includes('customer-portal/contracts/sign-pending')) {
        return Promise.resolve({
          data: {
            items: [
              {
                CtsUUID: 'signer-1',
                CteUUID: 'env-1',
                CtdUUID: 'doc-1',
                CtsName: 'John Doe',
                CtsEmail: 'john@example.com',
                CtsRole: 'signer',
                CtsRoutingOrder: 1,
                CtsStatus: 'pending',
                CteTitle: 'Service Agreement Envelope',
                CtdTitle: 'Master Service Agreement',
                CtdNumber: 'MSA-2026-001',
                CteSentAt: '2026-11-08T12:00:00Z',
                CteExpiresAt: '2026-12-08T12:00:00Z',
              },
            ],
          },
        });
      }
      if (
        path.includes('customer-portal/contracts/accounts') &&
        !path.includes('templates') &&
        !path.includes('obligations')
      ) {
        return Promise.resolve({
          data: {
            items: [
              {
                CtaUUID: 'acc-1',
                CtaKind: 'customer',
                CtaName: 'Acme Corp Account',
                CtaLegalName: 'Acme Corporation LTDA',
                CtaTaxId: '12345678000199',
                CtaCountry: 'BRA',
                CtaStatus: 'active',
                CtaIsPublished: 1,
                CtaCreatedAt: '2026-11-08T10:00:00Z',
              },
            ],
          },
        });
      }
      if (path.includes('customer-portal/contracts/documents')) {
        return Promise.resolve({
          data: {
            items: [
              {
                CtdUUID: 'doc-1',
                CtaUUID: 'acc-1',
                CtdTitle: 'Master Service Agreement',
                CtdNumber: 'MSA-2026-001',
                CtdStatus: 'active',
                CtdKind: 'service_agreement',
                CtdLanguage: 'pt-BR',
                CtdEffectiveDate: '2026-11-01',
                CtdExpirationDate: '2027-11-01',
                CtdCreatedAt: '2026-11-08T10:00:00Z',
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
        });
      }
      if (path.includes('customer-portal/contracts/envelopes')) {
        return Promise.resolve({
          data: {
            items: [
              {
                CteUUID: 'env-1',
                CtaUUID: 'acc-1',
                CtdUUID: 'doc-1',
                CteTitle: 'Service Agreement Envelope',
                CteStatus: 'sent',
                CteProvider: 'clicksign',
                CteProviderEnvelopeId: 'ext-env-1',
                CteSentAt: '2026-11-08T12:00:00Z',
                CteCompletedAt: null,
                CteExpiresAt: '2026-12-08T12:00:00Z',
                CteCreatedAt: '2026-11-08T11:00:00Z',
                Signers: [
                  {
                    CtsUUID: 'signer-1',
                    CteUUID: 'env-1',
                    CtsRole: 'signer',
                    CtsName: 'John Doe',
                    CtsEmail: 'john@example.com',
                    CtsPhone: null,
                    CtsRoutingOrder: 1,
                    CtsStatus: 'pending',
                    CtsSignatureType: null,
                    CtsSignedAt: null,
                    CtsDeclinedReason: null,
                  },
                ],
              },
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
        });
      }
      if (path.includes('templates')) {
        return Promise.resolve({
          data: {
            items: [
              {
                CtmUUID: 'tpl-1',
                CtaUUID: 'acc-1',
                CtmName: 'Standard Reseller Template',
                CtmDescription: 'Template description',
                CtmCategory: 'sla',
                CtmStatus: 'active',
                CtmCreatedAt: '2026-11-08T10:00:00Z',
              },
            ],
            total: 1,
            limit: 50,
            offset: 0,
          },
        });
      }
      if (path.includes('obligations')) {
        return Promise.resolve({
          data: {
            items: [
              {
                CtbUUID: 'obl-1',
                CtaUUID: 'acc-1',
                CtdUUID: 'doc-1',
                CtbTitle: 'Deliver Quarterly Report',
                CtbKind: 'reporting',
                CtbParty: 'internal',
                CtbDueDate: '2026-12-31',
                CtbStatus: 'pending',
                CtbCreatedAt: '2026-11-08T10:00:00Z',
              },
            ],
            total: 1,
            limit: 50,
            offset: 0,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    apiPost = vi.fn().mockImplementation((path: string) => {
      if (path.includes('/sign')) {
        return Promise.resolve({
          data: {
            ok: true,
            sequence: 1,
            eventHash: 'abcd1234ef',
            envelopeStatus: 'completed',
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    apiGetBlob = vi.fn().mockResolvedValue(new Blob(['dummy pdf'], { type: 'application/pdf' }));

    TestBed.configureTestingModule({
      imports: [
        ContractsPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [
        {
          provide: ApiService,
          useValue: {
            get: apiGet,
            post: apiPost,
            getBlob: apiGetBlob,
          },
        },
      ],
    });
  });

  it('loads contracts data, documents, envelopes and pending signatures on initialization', async () => {
    const fixture = TestBed.createComponent(ContractsPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadAll();
    fixture.detectChanges();

    expect(comp.signPending().length).toBe(1);
    expect(comp.signPending()[0].CteTitle).toBe('Service Agreement Envelope');
    expect(comp.documents().length).toBe(1);
    expect(comp.documents()[0].CtdTitle).toBe('Master Service Agreement');
    expect(comp.envelopes().length).toBe(1);
    expect(comp.envelopes()[0].CteStatus).toBe('sent');
    expect(comp.accounts().length).toBe(1);
  });

  it('switches tabs and loads reseller templates and obligations', async () => {
    const fixture = TestBed.createComponent(ContractsPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadAll();

    await comp.selectTab('reseller');
    fixture.detectChanges();

    expect(comp.activeTab()).toBe('reseller');
    expect(comp.templates().length).toBe(1);
    expect(comp.templates()[0].CtmName).toBe('Standard Reseller Template');
    expect(comp.obligations().length).toBe(1);
    expect(comp.obligations()[0].CtbTitle).toBe('Deliver Quarterly Report');
  });

  it('opens sign modal and confirms signature successfully', async () => {
    const fixture = TestBed.createComponent(ContractsPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadAll();

    const pendingItem = comp.signPending()[0];
    comp.openSignModal(pendingItem);
    expect(comp.selectedPendingToSign()).toBe(pendingItem);

    await comp.confirmSign();
    expect(apiPost).toHaveBeenCalledWith(expect.stringContaining('/signers/signer-1/sign'), {
      signatureType: 'clickwrap',
    });
    expect(comp.selectedPendingToSign()).toBeNull();
    expect(comp.successMessage()).toBe('contracts.signPending.success');
  });

  it('downloads envelope PDF blob', async () => {
    const fixture = TestBed.createComponent(ContractsPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    await comp.loadAll();

    const env = comp.envelopes()[0];
    await comp.downloadEnvelope(env);
    expect(apiGetBlob).toHaveBeenCalledWith(
      expect.stringContaining('/contracts/envelopes/env-1/download'),
    );
  });
});
