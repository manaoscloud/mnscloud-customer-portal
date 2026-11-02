import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import es from '../../../../public/i18n/es-ES.json';
import pt from '../../../../public/i18n/pt-BR.json';
import { PortalI18nService, detectPortalLanguage, resolveInitialLanguage } from './portal-i18n.service';

function setBrowserLanguage(value: string) {
  Object.defineProperty(navigator, 'language', { value, configurable: true });
}

describe('PortalI18nService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en, 'pt-BR': pt, 'es-ES': es },
          translocoConfig: { availableLangs: ['pt-BR', 'en-US', 'es-ES'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
    });
  });

  // The runner shares globals between spec files: leave no browser language or manual choice behind.
  afterEach(() => {
    localStorage.clear();
    delete (navigator as { language?: string }).language;
    document.documentElement.lang = '';
  });

  it('follows the browser like the App: pt → pt-BR, es → es-ES, anything else → en-US', () => {
    setBrowserLanguage('pt-PT');
    expect(detectPortalLanguage()).toBe('pt-BR');
    setBrowserLanguage('es-AR');
    expect(detectPortalLanguage()).toBe('es-ES');
    setBrowserLanguage('fr-FR');
    expect(detectPortalLanguage()).toBe('en-US');
  });

  it('keeps a manual choice with the App storage keys and applies it to the document', async () => {
    setBrowserLanguage('en-US');
    const service = TestBed.inject(PortalI18nService);

    await service.setLanguage('es-ES');

    expect(localStorage.getItem('mc_language')).toBe('es-ES');
    expect(localStorage.getItem('mc_language_mode')).toBe('manual');
    expect(resolveInitialLanguage()).toBe('es-ES');
    expect(document.documentElement.lang).toBe('es-ES');
    expect(service.t('nav.dashboard')).toBe('Panel');
  });

  it('ignores a stored language without a manual mode', () => {
    setBrowserLanguage('pt-BR');
    localStorage.setItem('mc_language', 'es-ES');
    expect(resolveInitialLanguage()).toBe('pt-BR');
  });

  it('formats money and dates in the active language', async () => {
    const service = TestBed.inject(PortalI18nService);
    await service.setLanguage('pt-BR');
    expect(service.formatCurrency(10)).toContain('R$');
    expect(service.formatDate(new Date(2026, 9, 23))).toBe('23/10/2026');
    await service.setLanguage('en-US');
    expect(service.formatDate(new Date(2026, 9, 23))).toBe('10/23/2026');
  });
});
