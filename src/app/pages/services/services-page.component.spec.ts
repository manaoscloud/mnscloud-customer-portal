import { describe, expect, it } from 'vitest';
import { offerText, type PortalOffer } from './services-page.component';

const offer = (texts: PortalOffer['texts']): PortalOffer => ({
  slug: 'vps-start',
  kind: 'vps',
  currency: 'BRL',
  price: 99.9,
  setupFee: 0,
  cycle: 'monthly',
  trialDays: 0,
  approvalRequired: false,
  texts,
});

describe('offerText', () => {
  it('uses the portal language when the offer has it', () => {
    expect(
      offerText(offer({ 'pt-BR': { name: 'Servidor' }, 'en-US': { name: 'Server' } }), 'en-US')
        .name,
    ).toBe('Server');
  });

  it('falls back to pt-BR, then English, then Spanish, then the slug', () => {
    expect(offerText(offer({ 'pt-BR': { name: 'Servidor' } }), 'es-ES').name).toBe('Servidor');
    expect(offerText(offer({ 'es-ES': { name: 'Servidor ES' } }), 'en-US').name).toBe(
      'Servidor ES',
    );
    expect(offerText(offer({}), 'pt-BR').name).toBe('vps-start');
  });
});

describe('cancel confirmations', () => {
  it('exist only for the options the customer can use now', async () => {
    const { CANCEL_CONFIRM } = await import('./services-page.component');
    expect(Object.keys(CANCEL_CONFIRM).sort()).toEqual(['end_of_cycle', 'unpaid', 'withdrawal']);
  });
});

describe('plan change names', () => {
  it('use the portal language, then pt-BR, English, Spanish and the fallback', async () => {
    const { textsName } = await import('./services-page.component');
    expect(textsName({ 'en-US': { name: 'Big' }, 'pt-BR': { name: 'Grande' } }, 'en-US', 'x')).toBe(
      'Big',
    );
    expect(textsName({ 'pt-BR': { name: 'Grande' } }, 'es-ES', 'x')).toBe('Grande');
    expect(textsName(null, 'pt-BR', 'vps-2')).toBe('vps-2');
    expect(textsName({ 'pt-BR': { name: '' } }, 'pt-BR', 'vps-2')).toBe('vps-2');
  });
});
