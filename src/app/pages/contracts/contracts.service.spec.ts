import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiService } from '../../services/api.service';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;
  let apiGetBlob: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn();
    apiPost = vi.fn();
    apiGetBlob = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ContractsService,
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

    service = TestBed.inject(ContractsService);
  });

  it('lists accounts', async () => {
    apiGet.mockResolvedValueOnce({ data: { items: [{ CtaUUID: 'acc-1' }] } });
    const res = await service.listAccounts();
    expect(res).toEqual([{ CtaUUID: 'acc-1' }]);
    expect(apiGet).toHaveBeenCalledWith('customer-portal/contracts/accounts');
  });

  it('lists documents with search and pagination', async () => {
    apiGet.mockResolvedValueOnce({
      data: { items: [{ CtdUUID: 'doc-1' }], total: 1, limit: 10, offset: 5 },
    });
    const res = await service.listDocuments('test', 10, 5);
    expect(res.items).toHaveLength(1);
    expect(apiGet).toHaveBeenCalledWith(
      expect.stringContaining('customer-portal/contracts/documents?search=test&limit=10&offset=5'),
    );
  });

  it('downloads envelope as blob', async () => {
    const dummyBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
    apiGetBlob.mockResolvedValueOnce(dummyBlob);
    const res = await service.downloadEnvelope('env-123');
    expect(res).toBe(dummyBlob);
    expect(apiGetBlob).toHaveBeenCalledWith('customer-portal/contracts/envelopes/env-123/download');
  });

  it('signs envelope', async () => {
    apiPost.mockResolvedValueOnce({ data: { ok: true, sequence: 1 } });
    const res = await service.signEnvelope('env-1', 'signer-1', 'clickwrap');
    expect(res.ok).toBe(true);
    expect(apiPost).toHaveBeenCalledWith(
      'customer-portal/contracts/envelopes/env-1/signers/signer-1/sign',
      { signatureType: 'clickwrap' },
    );
  });
});
