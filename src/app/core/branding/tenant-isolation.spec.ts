import { resolveTenantBranding } from './resolve-tenant-branding';
import { BrandingService } from './branding.service';
import { DEFAULT_EUDISTACK_BRANDING, TenantBrandingResult } from './tenant-branding.model';

/**
 * Riesgo R-2: la marca de un tenant NUNCA debe filtrar al siguiente, ni por
 * caché, ni por estado residual, ni por fallback. Ejercita resolución y
 * aplicación con dos temas seguidos.
 */
describe('Tenant isolation (no-bleed, R-2)', () => {
  let brandingService: BrandingService;

  beforeEach(() => {
    brandingService = new BrandingService();
    document.documentElement.removeAttribute('style');
  });

  function themeFor(tenant: 'A' | 'B'): TenantBrandingResult {
    return {
      ok: true,
      descriptor: {
        branding: {
          primaryColor: tenant === 'A' ? '#111111' : '#222222',
          secondaryColor: tenant === 'A' ? '#333333' : '#444444',
          logoUrl: `/assets/tenants/tenant-${tenant.toLowerCase()}/logo.svg`,
        },
        i18n: { defaultLang: tenant === 'A' ? 'es' : 'en', available: tenant === 'A' ? ['es'] : ['en'] },
      },
    };
  }

  it('tenant B never inherits tenant A tokens or logo', () => {
    brandingService.apply(resolveTenantBranding(themeFor('A')));
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#111111');

    brandingService.apply(resolveTenantBranding(themeFor('B')));

    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#222222');
    expect(document.documentElement.style.getPropertyValue('--brand-secondary')).toBe('#444444');
    expect(brandingService.logoUrl()).toContain('tenant-b');
  });

  it('a tenant without theme falls back to the EUDIStack theme, never to the previous tenant', () => {
    brandingService.apply(resolveTenantBranding(themeFor('A')));

    brandingService.apply(resolveTenantBranding({ ok: false, reason: 'absent' }));

    expect(brandingService.logoUrl()).toBe(DEFAULT_EUDISTACK_BRANDING.logoUrl);
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe(
      DEFAULT_EUDISTACK_BRANDING.tokens['--brand-primary'],
    );
  });
});
