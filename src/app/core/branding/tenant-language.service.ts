import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TenantBranding } from './tenant-branding.model';

/** Idioma base de la aplicación — mismo valor que `defaultLanguage` en `provideTranslateService` (task 7). */
const BASE_LANGUAGE = 'es';

/**
 * Fija el idioma del portal para el tenant resuelto (AC-02). `resolveTenantBranding`
 * (task 3) ya garantiza que `branding.defaultLanguage` es una cadena no vacía,
 * pero no garantiza que pertenezca a `branding.supportedLanguages` del propio
 * tenant — esta validación cruzada es responsabilidad de este servicio: un
 * idioma no soportado cae al idioma base de la app, nunca a un valor crudo o
 * `undefined` (EC-03/EC-04).
 */
@Injectable({ providedIn: 'root' })
export class TenantLanguageService {
  private readonly translate = inject(TranslateService);

  apply(branding: TenantBranding): void {
    const lang = branding.supportedLanguages.includes(branding.defaultLanguage)
      ? branding.defaultLanguage
      : BASE_LANGUAGE;

    this.translate.use(lang);
  }
}
