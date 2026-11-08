import { canRequestUnblock, stateKey, type SecurityAccount } from './security-page.component';

const account = (unblock: number) => ({ Unblock: unblock }) as SecurityAccount;
const block = (requestStatus: string | null) =>
  ({ uuid: 'b', value: '198.51.100.9', action: 'ban', scenario: null, expiresAt: null, serverName: null, requestStatus });

describe('Security portal page helpers', () => {
  it('translates known server states and falls back for unknown ones', () => {
    expect(stateKey('protection', 'partial')).toBe('security.states.protection.partial');
    expect(stateKey('alert', 'deleted')).toBe('security.states.alert.other');
    expect(stateKey('secret', null)).toBe('security.states.secret.other');
  });

  it('offers an unblock request only with the grant and without a pending one', () => {
    expect(canRequestUnblock(account(1), block(null))).toBe(true);
    expect(canRequestUnblock(account(1), block('rejected'))).toBe(true);
    expect(canRequestUnblock(account(1), block('pending'))).toBe(false);
    expect(canRequestUnblock(account(0), block(null))).toBe(false);
    expect(canRequestUnblock(null, block(null))).toBe(false);
  });
});
