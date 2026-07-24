import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

/**
 * Nunca devuelve `undefined`/`null`/vacío (EC-03): ante una clave sin traducir,
 * cae a la traducción en el idioma por defecto si existe, o a la propia clave.
 */
export class DeterministicMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    const defaultTranslation = params.translateService.translations[
      params.translateService.defaultLang
    ]?.[params.key];
    return defaultTranslation || params.key;
  }
}
