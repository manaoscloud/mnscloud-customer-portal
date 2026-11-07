import { describe, expect, it } from 'vitest';
import { canReissue } from './financial-page.component';

describe('boleto second copy', () => {
  it('is offered to the owner and administrators when the API says it is available', () => {
    const boleto = { status: 'open', reissueOption: 'available' as const };
    expect(canReissue(boleto, 'CUSTOMER_OWNER')).toBe(true);
    expect(canReissue(boleto, 'CUSTOMER_ADMIN')).toBe(true);
    expect(canReissue(boleto, 'CUSTOMER_USER')).toBe(false);
    expect(canReissue(boleto, null)).toBe(false);
  });

  it('is hidden when unavailable, paid or canceled', () => {
    expect(canReissue({ status: 'open', reissueOption: 'none' }, 'CUSTOMER_OWNER')).toBe(false);
    expect(canReissue({ status: 'open' }, 'CUSTOMER_OWNER')).toBe(false);
    expect(canReissue({ status: 'paid', reissueOption: 'available' }, 'CUSTOMER_OWNER')).toBe(
      false,
    );
    expect(canReissue({ status: 'canceled', reissueOption: 'available' }, 'CUSTOMER_OWNER')).toBe(
      false,
    );
  });
});
