import { resolveTenantIdentity } from './resolve-tenant-identity';
import { resolveTenantBranding } from './resolve-tenant-branding';
import { BrandingService } from './branding.service';
import { DEFAULT_EUDISTACK_BRANDING, TenantBrandingResult } from './tenant-branding.model';

/**
 * Riesgo R-2 (Alto, aislado deliberadamente en su propio archivo/commit):
 * el branding de un tenant NUNCA debe filtrar al siguiente — ni por caché, ni
 * por estado residual, ni por fallback (AC-03/EC-05). Ejercita el pipeline
 * completo (identidad → resolución → aplicación) con dos tenants secuenciales.
 */
describe('Tenant isolation (no-bleed, R-2)', () => {
  let brandingService: BrandingService;

  beforeEach(() => {
    brandingService = new BrandingService();
    document.documentElement.removeAttribute('style');
    document.title = '';
  });

  function descriptorFor(tenant: 'A' | 'B'): TenantBrandingResult {
    return {
      ok: true,
      descriptor: {
        branding: {
          primaryColor: tenant === 'A' ? '#111111' : '#222222',
          secondaryColor: tenant === 'A' ? '#333333' : '#444444',
          logoUrl: `/assets/tenants/tenant-${tenant.toLowerCase()}/logo.svg`,
          faviconUrl: `/assets/tenants/tenant-${tenant.toLowerCase()}/favicon.svg`,
          name: `Tenant ${tenant}`,
        },
        i18n: {
          defaultLang: tenant === 'A' ? 'es' : 'en',
          available: tenant === 'A' ? ['es'] : ['en'],
        },
      },
    };
  }

  function resolveAndApply(hostname: string, result: TenantBrandingResult | null): void {
    const tenant = resolveTenantIdentity({ hostname }, {});
    expect(tenant).not.toBeNull();
    const branding = resolveTenantBranding(result);
    brandingService.apply(branding);
  }

  it('tenant B never inherits tenant A tokens, logo, favicon or app name', () => {
    resolveAndApply('tenant-a.eudistack.net', descriptorFor('A'));

    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#111111');
    expect(brandingService.appName()).toBe('Tenant A');

    resolveAndApply('tenant-b.eudistack.net', descriptorFor('B'));

    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#222222');
    expect(document.documentElement.style.getPropertyValue('--brand-secondary')).toBe('#444444');
    expect(brandingService.logoUrl()).toContain('tenant-b');
    expect(brandingService.logoUrl()).not.toContain('tenant-a');
    expect(brandingService.appName()).toBe('Tenant B');
    expect(document.title).toBe('Tenant B');
  });

  it('a tenant B without branding falls back to the neutral default, never to tenant A branding (EC-05)', () => {
    resolveAndApply('tenant-a.eudistack.net', descriptorFor('A'));
    expect(brandingService.appName()).toBe('Tenant A');

    resolveAndApply('tenant-b.eudistack.net', { ok: false, reason: 'absent' });

    expect(brandingService.appName()).toBe(DEFAULT_EUDISTACK_BRANDING.appName);
    expect(brandingService.logoUrl()).toBe(DEFAULT_EUDISTACK_BRANDING.logoUrl);
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe(
      DEFAULT_EUDISTACK_BRANDING.tokens['--brand-primary'],
    );
  });

  it('an unresolvable identity for B never reuses the previously resolved tenant (ES-03/EC-05)', () => {
    resolveAndApply('tenant-a.eudistack.net', descriptorFor('A'));

    const unresolvableTenant = resolveTenantIdentity({ hostname: 'localhost' }, {});
    expect(unresolvableTenant).toBeNull();

    const branding = resolveTenantBranding(null);
    brandingService.apply(branding);

    expect(brandingService.appName()).toBe(DEFAULT_EUDISTACK_BRANDING.appName);
    expect(brandingService.appName()).not.toBe('Tenant A');
  });
});
