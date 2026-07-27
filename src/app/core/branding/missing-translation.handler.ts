import { Injectable } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

/**
 * Handler determinista de claves ausentes (EC-03). `useDefaultLang: true`
 * (configurado en `app.config.ts`) ya hace que `@ngx-translate` intente el
 * catálogo del idioma por defecto (`es`) automáticamente antes de llegar aquí
 * — este handler solo se invoca cuando NI el idioma activo del tenant NI el
 * catálogo base tienen la clave (bug de contenido, fuera de alcance de
 * EUD-166). Devuelve la propia clave como último recurso defensivo: nunca
 * `undefined`/vacío.
 */
@Injectable()
export class AppMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    return params.key;
  }
}
