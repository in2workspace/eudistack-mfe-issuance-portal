import { ApplicationConfig, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MissingTranslationHandler, TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { routes } from './app.routes';
import { AppMissingTranslationHandler } from './core/branding/missing-translation.handler';
import { initializeBranding } from './core/branding/branding.initializer';
import { provideIssuancePortalApi } from './core/api/issuance-portal-api.providers';
import { issuancePortalApiInterceptor } from './core/api/issuance-portal-api.interceptor';
import { PortalTranslateLoader } from './core/i18n/portal-translate.loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([issuancePortalApiInterceptor])),
    provideIssuancePortalApi(),
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