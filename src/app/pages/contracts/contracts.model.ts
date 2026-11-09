export type ContractAccount = {
  CtaUUID: string;
  CtaKind: 'internal' | 'customer';
  CtaName: string;
  CtaLegalName: string;
  CtaTaxId: string | null;
  CtaCountry: string;
  CtaStatus: 'active' | 'suspended' | 'closed';
  CtaIsPublished: number;
  CtaCreatedAt: string;
};

export type ContractDocument = {
  CtdUUID: string;
  CtaUUID: string;
  CtdTitle: string;
  CtdNumber: string | null;
  CtdStatus:
    | 'draft'
    | 'under_review'
    | 'pending_signature'
    | 'partially_signed'
    | 'signed'
    | 'active'
    | 'expired'
    | 'terminated'
    | 'superseded'
    | 'cancelled';
  CtdKind: string;
  CtdLanguage: string;
  CtdEffectiveDate: string | null;
  CtdExpirationDate: string | null;
  CtdCreatedAt: string;
  LatestVersionUuid?: string | null;
  LatestVersionNumber?: number | null;
};

export type ContractSigner = {
  CtsUUID: string;
  CteUUID: string;
  CtsRole: string;
  CtsName: string;
  CtsEmail: string;
  CtsPhone: string | null;
  CtsRoutingOrder: number;
  CtsStatus: 'pending' | 'notified' | 'viewed' | 'authenticated' | 'signed' | 'declined';
  CtsSignatureType: string | null;
  CtsSignedAt: string | null;
  CtsDeclinedReason: string | null;
};

export type ContractEnvelope = {
  CteUUID: string;
  CtaUUID: string;
  CtdUUID: string;
  CteTitle: string;
  CteStatus:
    'draft' | 'sent' | 'partially_signed' | 'completed' | 'declined' | 'voided' | 'expired';
  CteProvider: string;
  CteProviderEnvelopeId: string | null;
  CteSentAt: string | null;
  CteCompletedAt: string | null;
  CteExpiresAt: string | null;
  CteCreatedAt: string;
  Signers?: ContractSigner[];
};

export type SignPendingItem = {
  CtsUUID: string;
  CteUUID: string;
  CtdUUID: string;
  CtsName: string;
  CtsEmail: string;
  CtsRole: string;
  CtsRoutingOrder: number;
  CtsStatus: string;
  CteTitle: string;
  CtdTitle: string;
  CtdNumber: string | null;
  CteSentAt: string | null;
  CteExpiresAt: string | null;
};

export type ContractTemplate = {
  CtmUUID: string;
  CtaUUID: string;
  CtmName: string;
  CtmDescription: string | null;
  CtmCategory: string;
  CtmStatus: 'draft' | 'active' | 'deprecated' | 'archived';
  CtmCreatedAt: string;
};

export type ContractObligation = {
  CtbUUID: string;
  CtaUUID: string;
  CtdUUID: string;
  CtbTitle: string;
  CtbKind: string;
  CtbParty: 'internal' | 'counterparty' | 'both';
  CtbDueDate: string | null;
  CtbStatus: 'pending' | 'in_progress' | 'fulfilled' | 'breached' | 'waived' | 'disputed';
  CtbCreatedAt: string;
};

export type PagedItems<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
