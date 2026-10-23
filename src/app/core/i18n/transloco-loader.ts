import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { from } from 'rxjs';
import { version as BUNDLE_VERSION } from '../../../../package.json';

/** Loads `public/i18n/<lang>.json` relative to the base href (the portal runs under /customer-portal/). */
@Injectable({ providedIn: 'root' })
export class PortalTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    const url = new URL(`i18n/${lang}.json?v=${encodeURIComponent(BUNDLE_VERSION)}`, document.baseURI);
    return from(
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Translation ${lang} unavailable.`);
        return response.json() as Promise<Translation>;
      }),
    );
  }
}
