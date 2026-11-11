import {
  antivirusName,
  CHECK_CODES,
  checkKey,
  sortChecks,
  acceptanceBounds,
  canAcceptRisk,
  canRequestUnblock,
  paragraphs,
  reportMonths,
  stateKey,
  type Finding,
  type SecurityAccount,
} from './security-page.component';

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

  it('offers risk acceptance only with the grant and for an open finding', () => {
    const finding = (status: string) => ({ status }) as Finding;
    const granted = { VulnAccept: 1 } as SecurityAccount;
    expect(canAcceptRisk(granted, finding('open'))).toBe(true);
    expect(canAcceptRisk(granted, finding('accepted_risk'))).toBe(false);
    expect(canAcceptRisk({ VulnAccept: 0 } as SecurityAccount, finding('open'))).toBe(false);
    expect(canAcceptRisk(null, finding('open'))).toBe(false);
    expect(stateKey('priority', 'P0')).toBe('security.states.priority.P0');
    expect(stateKey('finding', 'accepted_risk')).toBe('security.states.finding.accepted_risk');
  });

  it('lists the last 13 report months and bounds the acceptance to one year', () => {
    const months = reportMonths(new Date(2026, 0, 20));
    expect(months.length).toBe(13);
    expect(months[0]).toBe('2026-01');
    expect(months[1]).toBe('2025-12');
    expect(months[12]).toBe('2025-01');
    expect(acceptanceBounds(new Date(2026, 10, 8))).toEqual({ min: '2026-11-08', max: '2027-11-08' });
  });

  it('splits the published report text into paragraphs', () => {
    expect(paragraphs('First line\ncontinues.\n\n  Second.  \n\n\n')).toEqual(['First line\ncontinues.', 'Second.']);
    expect(paragraphs(null)).toEqual([]);
  });

  it('V12: translates known check codes, sorts failures first and names the antivirus', () => {
    expect(CHECK_CODES.length).toBe(49);
    expect(checkKey('checkTitle', 'mac.filevault')).toBe('security.checkTitle.mac.filevault');
    expect(checkKey('checkAdvice', 'ssh.root_login')).toBe('security.checkAdvice.ssh.root_login');
    expect(checkKey('checkTitle', 'future.check')).toBeNull();
    const sorted = sortChecks([
      { code: 'b', severity: 'low', status: 'pass', evidence: null, failingSince: null },
      { code: 'c', severity: 'low', status: 'fail', evidence: null, failingSince: null },
      { code: 'a', severity: 'high', status: 'fail', evidence: null, failingSince: null },
    ]);
    expect(sorted.map((c) => c.code)).toEqual(['a', 'c', 'b']);
    expect(stateKey('check', 'fail')).toBe('security.states.check.fail');
    const server = { antivirusEngine: 'xprotect', antivirusInstalled: 1 } as never;
    expect(antivirusName(server)).toBe('XProtect');
    expect(antivirusName({ antivirusEngine: 'clamav', antivirusInstalled: 0 } as never)).toBeNull();
  });
});
