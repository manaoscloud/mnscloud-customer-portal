import { describe, expect, it } from 'vitest';
import {
  canDecide,
  decisionValid,
  riskKey,
  sessionState,
  type ManagedApproval,
  type ManagedSession,
} from './managed-support.model';

describe('managed support model', () => {
  it('a refusal needs a note, an approval does not', () => {
    expect(decisionValid('approve', '')).toBe(true);
    expect(decisionValid('reject', '  ')).toBe(false);
    expect(decisionValid('reject', 'fora da janela')).toBe(true);
  });
  it('reads the decide flag and the known states and risks', () => {
    expect(canDecide({ CanDecide: 1 } as ManagedApproval)).toBe(true);
    expect(canDecide({ CanDecide: 0 } as ManagedApproval)).toBe(false);
    expect(sessionState({ SrsState: 'closed' } as ManagedSession)).toBe('closed');
    expect(sessionState({ SrsState: 'weird' } as ManagedSession)).toBe('other');
    expect(riskKey({ SrpRisk: 'x' } as ManagedApproval)).toBe('medium');
  });
});
