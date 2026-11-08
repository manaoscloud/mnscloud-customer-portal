import { describe, expect, it } from 'vitest';
import { accessPayload, formatOctets } from './authentication-portal';

const draft = {
  AuthenticationProfileAapUUID: 'p',
  AuthenticationGroupAagUUID: '',
  AuthenticationDomainAadUUID: 'd',
  subscriberLabel: '  Casa 12 ',
  framedIp: '',
  expiresAt: '',
  status: 1,
};

describe('authentication portal helpers', () => {
  it('sends only the allowed fields, never a customer, username or password', () => {
    const create = accessPayload(draft, true);
    expect(create).toEqual({
      AuthenticationProfileAapUUID: 'p',
      AuthenticationGroupAagUUID: null,
      AuthenticationDomainAadUUID: 'd',
      subscriberLabel: 'Casa 12',
      framedIp: null,
      expiresAt: null,
      status: 1,
    });
    const update = accessPayload({ ...draft, revision: 3, status: 0 }, false);
    expect(update).not.toHaveProperty('AuthenticationDomainAadUUID');
    expect(update).toMatchObject({ revision: 3, status: 0 });
  });

  it('formats accounting counters', () => {
    expect(formatOctets('0')).toBe('0 B');
    expect(formatOctets('6000000000')).toBe('5.6 GB');
  });
});
