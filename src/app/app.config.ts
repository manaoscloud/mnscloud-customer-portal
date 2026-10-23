import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import {
  FALLBACK_LANGUAGE,
  PORTAL_LANGUAGES,
  PortalI18nService,
  resolveInitialLanguage,
} from './core/i18n/portal-i18n.service';
import { PortalTranslocoLoader } from './core/i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideTransloco({
      config: {
        availableLangs: [...PORTAL_LANGUAGES],
        defaultLang: resolveInitialLanguage(),
        fallbackLang: FALLBACK_LANGUAGE,
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: PortalTranslocoLoader,
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      const language = inject(PortalI18nService).language();
      // The fallback is loaded too so a key missing in one language never shows the raw key.
      return Promise.all([
        firstValueFrom(transloco.load(language)),
        firstValueFrom(transloco.load(FALLBACK_LANGUAGE)),
      ]);
    }),
  ],
};
