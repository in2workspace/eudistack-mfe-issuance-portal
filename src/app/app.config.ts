import { ApplicationConfig, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { MissingTranslationHandler, TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { routes } from './app.routes';
import { AppMissingTranslationHandler } from './core/branding/missing-translation.handler';
import { initializeBranding } from './core/branding/branding.initializer';
import { provideHolderAuth } from './core/auth/holder-auth.providers';
import { provideIssuancePortalApi } from './core/api/issuance-portal-api.providers';
import { tokenRenewalInterceptor } from './core/auth/token-renewal.interceptor';
import { issuancePortalApiInterceptor } from './core/api/issuance-portal-api.interceptor';
import { journeyActivityInterceptor } from './core/journey/journey-activity.interceptor';
import { journeyErrorsInterceptor } from './core/journey/journey-errors.interceptor';
import { PortalTranslateLoader } from './core/i18n/portal-translate.loader';

/**
 * Interceptores HTTP, en orden: cada uno envuelve a los siguientes, así que
 * journeyErrorsInterceptor ve los errores ya traducidos a ApiProblemError.
 * tokenRenewalInterceptor repite la petición con el token renovado, que
 * añade issuancePortalApiInterceptor.
 */
export const httpInterceptors: HttpInterceptorFn[] = [
  journeyActivityInterceptor,
  journeyErrorsInterceptor,
  tokenRenewalInterceptor,
  issuancePortalApiInterceptor,
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors(httpInterceptors)),
    provideIssuancePortalApi(),
    provideHolderAuth(),
    // Sin defaultLanguage: lo fija TenantLanguageService cuando ya hay
    // configuración, para que el primer catálogo cargado lleve los textos del
    // tenant (PortalTranslateLoader).
    provideTranslateService({
      useDefaultLang: true,
      loader: {
        provide: TranslateLoader,
        useExisting: PortalTranslateLoader,
      },
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: AppMissingTranslationHandler,
      },
    }),
    provideAppInitializer(initializeBranding),
  ],
};