import { inject } from '@angular/core';
import { PortalConfigService, PortalConfigState } from '../config/portal-config.service';
import { resolveTenantBranding } from './resolve-tenant-branding';
import { BrandingService } from './branding.service';
import { TenantLanguageService } from './tenant-language.service';

/**
 * Carga la configuración del portal (`GET /config`) y aplica marca e idioma.
 * Sin configuración aplica la marca neutra. La usan el arranque y el botón
 * "Volver a intentarlo" de la pantalla de configuración no disponible.
 * Debe llamarse en un contexto de inyección.
 */
export async function loadPortalConfiguration(): Promise<PortalConfigState> {
  const configService = inject(PortalConfigService);
  const brandingService = inject(BrandingService);
  const languageService = inject(TenantLanguageService);

  const state = await configService.load();
  const branding = resolveTenantBranding(state.status === 'loaded' ? state.config : null);
  brandingService.apply(branding);
  languageService.apply(branding);
  return state;
}

/**
 * Aplica la configuración del portal ANTES de que Angular arranque el árbol
 * de componentes (sin flash). Resuelve SIEMPRE, nunca rechaza: el estado
 * `unavailable` de `PortalConfigService` lleva a la pantalla de configuración
 * no disponible (`configAvailableGuard`).
 *
 * Registro en `app.config.ts`:
 * ```ts
 * provideAppInitializer(initializeBranding)
 * ```
 */
export async function initializeBranding(): Promise<void> {
  try {
    await loadPortalConfiguration();
  } catch (err) {
    console.error('[BrandingInitializer] unexpected failure — bootstrap continues with neutral default', err);
  }
}
