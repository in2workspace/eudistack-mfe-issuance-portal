import { inject } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantBrandingResult } from './tenant-branding.model';
import { resolveTenantIdentity } from './resolve-tenant-identity';
import { resolveTenantBranding } from './resolve-tenant-branding';
import { TenantBrandingSource } from './tenant-branding.source';
import { BrandingService } from './branding.service';
import { TenantLanguageService } from './tenant-language.service';
import { PortalConfigService } from '../config/portal-config.service';

/**
 * Antes de que Angular arranque el árbol de componentes (sin flash), pide a
 * la vez el `theme.json` del tenant y `GET /config` (design.md AD-4). Con los
 * dos aplica la marca y el idioma, para que el primer catálogo ya lleve los
 * textos del tenant. La marca no depende de `/config`: si la configuración
 * falla se aplica igual y `configAvailableGuard` lleva al error de
 * configuración. Sin tema, o si no carga, el tema de EUDIStack. Resuelve
 * siempre, nunca rechaza.
 *
 * Registro en `app.config.ts`:
 * ```ts
 * provideAppInitializer(initializeBranding)
 * ```
 */
export async function initializeBranding(): Promise<void> {
  const source = inject(TenantBrandingSource);
  const configService = inject(PortalConfigService);
  const brandingService = inject(BrandingService);
  const languageService = inject(TenantLanguageService);

  try {
    const tenant = resolveTenantIdentity(window.location, environment);
    const theme: Promise<TenantBrandingResult | null> = tenant
      ? firstValueFrom(source.load(tenant).pipe(catchError(() => of<TenantBrandingResult>({ ok: false, reason: 'error' }))))
      : Promise.resolve(null);

    const [result] = await Promise.all([theme, configService.load()]);
    const branding = resolveTenantBranding(result);
    brandingService.apply(branding);
    languageService.apply(branding);
  } catch (err) {
    console.error('[BrandingInitializer] unexpected failure — bootstrap continues with neutral default', err);
  }
}
