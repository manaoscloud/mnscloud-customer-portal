import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import type {
  ContractAccount,
  ContractDocument,
  ContractEnvelope,
  ContractObligation,
  ContractTemplate,
  PagedItems,
  SignPendingItem,
} from './contracts.model';

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly api = inject(ApiService);

  async listAccounts(): Promise<ContractAccount[]> {
    const res = await this.api.get<ApiEnvelope<{ items: ContractAccount[] }>>(
      'customer-portal/contracts/accounts',
    );
    return res.data?.items ?? [];
  }

  async listDocuments(search = '', limit = 20, offset = 0): Promise<PagedItems<ContractDocument>> {
    const query = new URLSearchParams({ search, limit: String(limit), offset: String(offset) });
    const res = await this.api.get<ApiEnvelope<PagedItems<ContractDocument>>>(
      `customer-portal/contracts/documents?${query}`,
    );
    return res.data ?? { items: [], total: 0, limit, offset };
  }

  async getDocument(documentUuid: string): Promise<ContractDocument | null> {
    const res = await this.api.get<ApiEnvelope<ContractDocument>>(
      `customer-portal/contracts/documents/${encodeURIComponent(documentUuid)}`,
    );
    return res.data ?? null;
  }

  async listEnvelopes(
    search = '',
    status = '',
    limit = 20,
    offset = 0,
  ): Promise<PagedItems<ContractEnvelope>> {
    const params: Record<string, string> = { search, limit: String(limit), offset: String(offset) };
    if (status) params['status'] = status;
    const query = new URLSearchParams(params);
    const res = await this.api.get<ApiEnvelope<PagedItems<ContractEnvelope>>>(
      `customer-portal/contracts/envelopes?${query}`,
    );
    return res.data ?? { items: [], total: 0, limit, offset };
  }

  async getEnvelope(envelopeUuid: string): Promise<ContractEnvelope | null> {
    const res = await this.api.get<ApiEnvelope<ContractEnvelope>>(
      `customer-portal/contracts/envelopes/${encodeURIComponent(envelopeUuid)}`,
    );
    return res.data ?? null;
  }

  async downloadEnvelope(envelopeUuid: string): Promise<Blob> {
    return this.api.getBlob(
      `customer-portal/contracts/envelopes/${encodeURIComponent(envelopeUuid)}/download`,
    );
  }

  async listSignPending(): Promise<SignPendingItem[]> {
    const res = await this.api.get<ApiEnvelope<{ items: SignPendingItem[] }>>(
      'customer-portal/contracts/sign-pending',
    );
    return res.data?.items ?? [];
  }

  async signEnvelope(
    envelopeUuid: string,
    signerUuid: string,
    signatureType = 'clickwrap',
  ): Promise<{ ok: boolean; sequence?: number; eventHash?: string; envelopeStatus?: string }> {
    const res = await this.api.post<
      ApiEnvelope<{ ok: boolean; sequence?: number; eventHash?: string; envelopeStatus?: string }>
    >(
      `customer-portal/contracts/envelopes/${encodeURIComponent(envelopeUuid)}/signers/${encodeURIComponent(signerUuid)}/sign`,
      { signatureType },
    );
    return res.data ?? { ok: false };
  }

  async listTemplates(
    accountUuid: string,
    search = '',
    limit = 20,
    offset = 0,
  ): Promise<PagedItems<ContractTemplate>> {
    const query = new URLSearchParams({ search, limit: String(limit), offset: String(offset) });
    const res = await this.api.get<ApiEnvelope<PagedItems<ContractTemplate>>>(
      `customer-portal/contracts/accounts/${encodeURIComponent(accountUuid)}/templates?${query}`,
    );
    return res.data ?? { items: [], total: 0, limit, offset };
  }

  async listObligations(
    accountUuid: string,
    search = '',
    status = '',
    limit = 20,
    offset = 0,
  ): Promise<PagedItems<ContractObligation>> {
    const params: Record<string, string> = { search, limit: String(limit), offset: String(offset) };
    if (status) params['status'] = status;
    const query = new URLSearchParams(params);
    const res = await this.api.get<ApiEnvelope<PagedItems<ContractObligation>>>(
      `customer-portal/contracts/accounts/${encodeURIComponent(accountUuid)}/obligations?${query}`,
    );
    return res.data ?? { items: [], total: 0, limit, offset };
  }
}
