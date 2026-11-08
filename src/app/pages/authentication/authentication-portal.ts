// Pure helpers of the Authentication portal page (unit-tested without Angular).

export type AccessDraft = {
  AaxUUID?: string;
  revision?: number;
  AuthenticationProfileAapUUID: string | null;
  AuthenticationGroupAagUUID: string | null;
  AuthenticationDomainAadUUID: string | null;
  subscriberLabel: string;
  framedIp: string;
  expiresAt: string;
  status: number;
};

/** Bytes as a short human value (accounting counters arrive as strings). */
export function formatOctets(value: string | number | null | undefined): string {
  let size = Number(value ?? 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Empty strings become null; the API rejects unknown fields and never accepts a customer. */
export function accessPayload(draft: AccessDraft, create: boolean): Record<string, unknown> {
  const text = (value: string) => (value.trim() ? value.trim() : null);
  return {
    AuthenticationProfileAapUUID: draft.AuthenticationProfileAapUUID || null,
    AuthenticationGroupAagUUID: draft.AuthenticationGroupAagUUID || null,
    subscriberLabel: text(draft.subscriberLabel),
    framedIp: text(draft.framedIp),
    expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
    status: draft.status ? 1 : 0,
    ...(create
      ? { AuthenticationDomainAadUUID: draft.AuthenticationDomainAadUUID || null }
      : { revision: draft.revision }),
  };
}
