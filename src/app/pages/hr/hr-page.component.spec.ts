import { hours, monthRange } from './hr-page.component';

describe('HR portal page helpers', () => {
  it('formats minutes as h:mm, signing balances only', () => {
    expect(hours(0)).toBe('0:00');
    expect(hours(485)).toBe('8:05');
    expect(hours(-30, true)).toBe('-0:30');
    expect(hours(75, true)).toBe('+1:15');
    expect(hours(0, true)).toBe('0:00');
  });

  it('covers the whole month, leap years included', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});
