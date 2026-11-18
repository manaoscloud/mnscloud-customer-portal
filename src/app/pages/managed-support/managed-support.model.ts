/** Device under managed support (never its address, credential or host key). */
export interface ManagedDevice {
  NwdUUID: string;
  NwdName: string;
  NwdDeviceClass: string;
  NwdVendorType: string;
  NwdModel: string | null;
  SiteName: string;
  NwdLifecycle: string;
  LastSessionAt: string | null;
  PendingApprovals: number;
}

/** Summary of a managed support session (never notes, commands or recordings). */
export interface ManagedSession {
  SrsUUID: string;
  SrsID: string;
  SrsTitle: string;
  SrsState: string;
  SrsDateCreated: string;
  SrsClosedAt: string | null;
  Devices: string[] | null;
  AppliedChanges: number;
}

/** A change the support team proposes and that waits for the customer's decision. */
export interface ManagedApproval {
  SrpUUID: string;
  SrpTitle: string;
  SrpJustification: string;
  SrpRisk: 'low' | 'medium' | 'high' | string;
  SrpSafeChange: string;
  SrpCommands: string[];
  DeviceName: string;
  TechnicianNote: string | null;
  SrpExpiresAt: string;
  SrpRevision: number;
  CanDecide: number | boolean;
}

export type Decision = 'approve' | 'reject';

/** A refusal needs a note; an approval may have one. */
export function decisionValid(decision: Decision, note: string): boolean {
  return decision === 'approve' || note.trim().length > 0;
}

export function canDecide(approval: ManagedApproval): boolean {
  return approval.CanDecide === true || Number(approval.CanDecide) === 1;
}

/** Known session states; anything else shows as "other". */
export function sessionState(session: ManagedSession): string {
  return ['open', 'waiting_customer', 'closed'].includes(session.SrsState)
    ? session.SrsState
    : 'other';
}

export function riskKey(approval: ManagedApproval): string {
  return ['low', 'medium', 'high'].includes(approval.SrpRisk) ? approval.SrpRisk : 'medium';
}
