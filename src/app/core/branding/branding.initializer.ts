import { inject } from '@angular/core';
import { PortalConfigService } from '../config/portal-config.service';
import { resolveTenantBranding } from './resolve-tenant-branding';
import { BrandingService } from './branding.service';
import { TenantLanguageService } from './tenant-language.service';

/**
 * Carga la configuración del portal (`GET /config`) y aplica marca e idioma
 * ANTES de que Angular arranque el árbol de componentes (sin flash). Resuelve
 * SIEMPRE, nunca rechaza: sin configuración se aplica la marca neutra y el
 * estado `unavailable` de `PortalConfigService` decide qué pantalla se ve.
 *
 * Registro en `app.config.ts`:
 * ```ts
 * provideAppInitializer(initializeBranding)
 * ```
 */
export async function initializeBranding(): Promise<void> {
  const configService = inject(PortalConfigService);
  const brandingService = inject(BrandingService);
  const languageService = inject(TenantLanguageService);

  try {
    const state = await configService.load();
    const branding = resolveTenantBranding(state.status === 'loaded' ? state.config : null);
    brandingService.apply(branding);
    languageService.apply(branding);
  } catch (err) {
    console.error('[BrandingInitializer] unexpected failure — bootstrap continues with neutral default', err);
  }
}
