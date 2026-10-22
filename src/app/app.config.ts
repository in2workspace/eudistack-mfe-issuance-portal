import { ApplicationConfig, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { MissingTranslationHandler, TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { AppMissingTranslationHandler } from './core/branding/missing-translation.handler';
import { initializeBranding } from './core/branding/branding.initializer';
import { provideIssuancePortalApi } from './core/api/issuance-portal-api.providers';
import { issuancePortalApiInterceptor } from './core/api/issuance-portal-api.interceptor';

export function httpTranslateLoader(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, 'assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([issuancePortalApiInterceptor])),
    provideIssuancePortalApi(),
    provideTranslateService({
      defaultLanguage: 'es',
      useDefaultLang: true,
      loader: {
        provide: TranslateLoader,
        useFactory: httpTranslateLoader,
        deps: [HttpClient],
      },
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: AppMissingTranslationHandler,
      },
    }),
    provideAppInitializer(initializeBranding),
  ],
};