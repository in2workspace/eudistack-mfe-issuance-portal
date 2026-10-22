import { resolveTenantBranding } from './resolve-tenant-branding';
import { BrandingService } from './branding.service';
import { DEFAULT_EUDISTACK_BRANDING } from './tenant-branding.model';
import { PortalConfig } from '../api/generated/journey';

/**
 * Riesgo R-2: la marca de un tenant NUNCA debe filtrar al siguiente, ni por
 * caché, ni por estado residual, ni por fallback (EC-03 de EUD-283). Ejercita
 * resolución y aplicación con dos configuraciones seguidas.
 */
describe('Tenant isolation (no-bleed, R-2)', () => {
  let brandingService: BrandingService;

  beforeEach(() => {
    brandingService = new BrandingService();
    document.documentElement.removeAttribute('style');
  });

  function configFor(tenant: 'A' | 'B'): PortalConfig {
    return {
      branding: {
        logo_url: `/assets/tenants/tenant-${tenant.toLowerCase()}/logo.svg`,
        colors: { primary: tenant === 'A' ? '#111111' : '#222222', secondary: tenant === 'A' ? '#333333' : '#444444' },
      },
      languages: tenant === 'A' ? ['es'] : ['en'],
      texts: {},
      support: {},
      legal_links: {},
    };
  }

  it('tenant B never inherits tenant A tokens or logo', () => {
    brandingService.apply(resolveTenantBranding(configFor('A')));
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#111111');

    brandingService.apply(resolveTenantBranding(configFor('B')));

    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#222222');
    expect(document.documentElement.style.getPropertyValue('--brand-secondary')).toBe('#444444');
    expect(brandingService.logoUrl()).toContain('tenant-b');
    expect(brandingService.logoUrl()).not.toContain('tenant-a');
  });

  it('a tenant without configuration falls back to the neutral default, never to the previous tenant', () => {
    brandingService.apply(resolveTenantBranding(configFor('A')));

    brandingService.apply(resolveTenantBranding(null));

    expect(brandingService.logoUrl()).toBe(DEFAULT_EUDISTACK_BRANDING.logoUrl);
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe(
      DEFAULT_EUDISTACK_BRANDING.tokens['--brand-primary'],
    );
  });
});
