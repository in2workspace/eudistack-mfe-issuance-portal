import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, catchError, map, of } from 'rxjs';
import { PortalConfigService } from '../config/portal-config.service';

function isObject(value: unknown): value is TranslationObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mezcla `override` sobre `base`, entrando en los objetos anidados. */
function deepMerge(base: TranslationObject, override: TranslationObject): TranslationObject {
  const merged: TranslationObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isObject(current) && isObject(value) ? deepMerge(current, value) : value;
  }
  return merged;
}

/**
 * Textos del portal (design.md AD-4): los del producto de
 * `assets/i18n/{idioma}.json` y, encima, los del tenant de `texts[idioma]` en
 * `GET /config`, que ganan. Si el producto no tiene fichero para un idioma del
 * tenant, quedan los textos del tenant y el castellano de respaldo.
 */
@Injectable({ providedIn: 'root' })
export class PortalTranslateLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);
  private readonly config = inject(PortalConfigService);

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`assets/i18n/${lang}.json`).pipe(
      catchError(() => of({} as TranslationObject)),
      map((product) => {
        const tenantTexts = this.config.config()?.texts?.[lang];
        return isObject(tenantTexts) ? deepMerge(product, tenantTexts) : product;
      }),
    );
  }
}
