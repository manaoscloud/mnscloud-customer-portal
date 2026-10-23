import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

/** Same languages, storage keys and detection rules as the MNSCloud App (app-i18n.service.ts). */
export type PortalLanguage = 'pt-BR' | 'en-US' | 'es-ES';

export const PORTAL_LANGUAGES: readonly PortalLanguage[] = ['pt-BR', 'en-US', 'es-ES'];
export const FALLBACK_LANGUAGE: PortalLanguage = 'en-US';

const LANGUAGE_STORAGE_KEY = 'mc_language';
const LANGUAGE_MODE_STORAGE_KEY = 'mc_language_mode';

export function isPortalLanguage(value: unknown): value is PortalLanguage {
  return value === 'pt-BR' || value === 'en-US' || value === 'es-ES';
}

export function detectPortalLanguage(): PortalLanguage {
  if (typeof navigator === 'undefined') return FALLBACK_LANGUAGE;
  const browserLanguage = (navigator.language || '').toLowerCase();
  if (browserLanguage.startsWith('pt')) return 'pt-BR';
  if (browserLanguage.startsWith('es')) return 'es-ES';
  return FALLBACK_LANGUAGE;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode, policy): the choice only lasts for this page view.
  }
}

export function resolveInitialLanguage(): PortalLanguage {
  const stored = readStorage(LANGUAGE_STORAGE_KEY);
  if (readStorage(LANGUAGE_MODE_STORAGE_KEY) === 'manual' && isPortalLanguage(stored)) return stored;
  return detectPortalLanguage();
}

@Injectable({ providedIn: 'root' })
export class PortalI18nService {
  private readonly transloco = inject(TranslocoService);

  readonly languages = PORTAL_LANGUAGES;
  readonly language = signal<PortalLanguage>(resolveInitialLanguage());

  constructor() {
    this.apply(this.language());
    this.bindNavigatorLanguageChange(inject(DestroyRef));
  }

  t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  /** Manual choice, kept like in the App so both clients on the same domain agree. */
  async setLanguage(language: PortalLanguage): Promise<void> {
    writeStorage(LANGUAGE_STORAGE_KEY, language);
    writeStorage(LANGUAGE_MODE_STORAGE_KEY, 'manual');
    await this.load(language);
    this.apply(language);
  }

  formatCurrency(value: number, currency = 'BRL'): string {
    return new Intl.NumberFormat(this.language(), { style: 'currency', currency }).format(value);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString(this.language());
  }

  /** Loads before switching so texts read in code (snackbars, labels) never see a missing language. */
  private async load(language: PortalLanguage): Promise<void> {
    await firstValueFrom(this.transloco.load(language)).catch(() => undefined);
  }

  private apply(language: PortalLanguage): void {
    this.language.set(language);
    this.transloco.setActiveLang(language);
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }

  private bindNavigatorLanguageChange(destroyRef: DestroyRef): void {
    if (typeof window === 'undefined') return;
    const handle = () => {
      if (readStorage(LANGUAGE_MODE_STORAGE_KEY) === 'manual') return;
      const language = detectPortalLanguage();
      void this.load(language).then(() => this.apply(language));
    };
    window.addEventListener('languagechange', handle);
    destroyRef.onDestroy(() => window.removeEventListener('languagechange', handle));
  }
}
