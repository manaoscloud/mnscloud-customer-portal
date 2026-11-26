export type CustomerPortalIspSubscription = {
  subscriptionUUID: string;
  subscriptionID: number;
  status: string;
  effectiveState: string;
  planName: string;
  downloadKbps: number;
  uploadKbps: number;
  technology: string;
  framedIp: string | null;
  accessUsername: string | null;
  activationDate: string | null;
  cancellationDate: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressMunicipalityCode: string | null;
  dunningBlocked: number;
  trustUnlockActive: number;
  equipments?: CustomerPortalIspEquipment[];
};

export type CustomerPortalIspEquipment = {
  serialNumber: string;
  macAddress: string | null;
  gponSn: string | null;
  state: string;
};

export type CustomerPortalIspCancelResult = {
  subscriptionUUID: string;
  status: string;
  protocol: string;
  cancellationDate: string;
  removalScheduled: boolean;
};

export type CustomerPortalIspChangePlanResult = {
  subscriptionUUID: string;
  pendingPlanUUID: string;
  pendingPlanName: string;
  pendingPlanDate: string;
};

export type CustomerPortalIspSubscriptionStatus = {
  subscriptionUUID: string;
  isOnline: number;
  ipAddress: string | null;
  username: string | null;
  sessionStartedAt: string | null;
  monthlyDownloadBytes: number;
  monthlyUploadBytes: number;
};

export type CustomerPortalIspTrustUnlockResult = {
  unlocked: number;
  startsAt: string;
  endsAt: string;
  days: number;
  remainingThisMonth: number;
  reason: string;
};

export function speedLabel(kbps: number | null | undefined): string {
  if (!kbps || kbps <= 0) return '0 Mbps';
  if (kbps >= 1000000) return `${(kbps / 1000000).toFixed(1)} Gbps`;
  return `${Math.round(kbps / 1000)} Mbps`;
}

export function trafficLabel(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 GB';
  const gib = bytes / (1024 * 1024 * 1024);
  return `${gib.toFixed(1)} GB`;
}
