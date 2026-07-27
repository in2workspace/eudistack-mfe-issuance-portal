import { resolveTenantBranding } from './resolve-tenant-branding';
import { DEFAULT_EUDISTACK_BRANDING, TenantBrandingResult } from './tenant-branding.model';

describe('resolveTenantBranding', () => {
  it('returns the neutral default when there is no result (identity not resolvable, ES-03)', () => {
    expect(resolveTenantBranding(null)).toEqual(DEFAULT_EUDISTACK_BRANDING);
  });

  it('returns the neutral default when the tenant has no branding configured (EC-01)', () => {
    const result: TenantBrandingResult = { ok: false, reason: 'absent' };
    expect(resolveTenantBranding(result)).toEqual(DEFAULT_EUDISTACK_BRANDING);
  });

  it('returns the neutral default for any fail-safe reason (ES-02/ES-04/ES-05)', () => {
    (['absent', 'invalid', 'error', 'timeout'] as const).forEach((reason) => {
      expect(resolveTenantBranding({ ok: false, reason })).toEqual(DEFAULT_EUDISTACK_BRANDING);
    });
  });

  it('merges present fields from the descriptor and falls back to default for absent ones (EC-02)', () => {
    const result: TenantBrandingResult = {
      ok: true,
      descriptor: { branding: { name: 'CGCOM' } },
    };

    const branding = resolveTenantBranding(result);

    expect(branding.appName).toBe('CGCOM');
    expect(branding.logoUrl).toBe(DEFAULT_EUDISTACK_BRANDING.logoUrl);
    expect(branding.faviconUrl).toBe(DEFAULT_EUDISTACK_BRANDING.faviconUrl);
    expect(branding.defaultLanguage).toBe(DEFAULT_EUDISTACK_BRANDING.defaultLanguage);
    expect(branding.supportedLanguages).toEqual(DEFAULT_EUDISTACK_BRANDING.supportedLanguages);
    expect(branding.tokens).toEqual(DEFAULT_EUDISTACK_BRANDING.tokens);
  });

  it('resolves in runtime with no build-time branch: same function, different tenant descriptors (AC-04)', () => {
    const tenantA = resolveTenantBranding({ ok: true, descriptor: { branding: { name: 'Tenant A' } } });
    const tenantB = resolveTenantBranding({ ok: true, descriptor: { branding: { name: 'Tenant B' } } });

    expect(tenantA.appName).toBe('Tenant A');
    expect(tenantB.appName).toBe('Tenant B');
  });

  it('a brand-new tenant resolves from config/assets alone, no code change (AC-05)', () => {
    const brandNewTenant = resolveTenantBranding({
      ok: true,
      descriptor: {
        branding: { name: 'Brand New Tenant', logoUrl: '/assets/tenants/brand-new/logo.svg' },
        i18n: { defaultLang: 'en', available: ['en'] },
      },
    });

    expect(brandNewTenant.appName).toBe('Brand New Tenant');
    expect(brandNewTenant.logoUrl).toBe('/assets/tenants/brand-new/logo.svg');
    expect(brandNewTenant.defaultLanguage).toBe('en');
    expect(brandNewTenant.supportedLanguages).toEqual(['en']);
  });

  it('derives --brand-accent from primaryColor when it is not near-white (typical tenant)', () => {
    const branding = resolveTenantBranding({
      ok: true,
      descriptor: {
        branding: {
          primaryColor: '#003057',
          primaryContrastColor: '#ffffff',
          secondaryColor: '#ffd100',
          secondaryContrastColor: '#003057',
        },
      },
    });

    expect(branding.tokens['--brand-accent']).toBe('#003057');
    expect(branding.tokens['--brand-accent-contrast']).toBe('#ffffff');
  });

  it('falls back to secondaryColor for --brand-accent when primaryColor is near-white (CGCOM)', () => {
    const branding = resolveTenantBranding({
      ok: true,
      descriptor: {
        branding: {
          primaryColor: '#ffffff',
          primaryContrastColor: '#46484C',
          secondaryColor: '#F9B000',
          secondaryContrastColor: '#46484C',
        },
      },
    });

    expect(branding.tokens['--brand-accent']).toBe('#F9B000');
    expect(branding.tokens['--brand-accent-contrast']).toBe('#46484C');
  });

  it('prefers logoDarkUrl over logoUrl (AD-2, headers here are white — logoUrl is meant for colored/dark backgrounds)', () => {
    const branding = resolveTenantBranding({
      ok: true,
      descriptor: {
        branding: {
          logoUrl: '/assets/tenants/acme/logo.svg',
          logoDarkUrl: '/assets/tenants/acme/logo-dark.svg',
        },
      },
    });

    expect(branding.logoUrl).toBe('/assets/tenants/acme/logo-dark.svg');
  });

  it('falls back to logoUrl when the tenant has no logoDarkUrl (e.g. CGCOM)', () => {
    const branding = resolveTenantBranding({
      ok: true,
      descriptor: { branding: { logoUrl: '/assets/tenants/cgcom/logo.png' } },
    });

    expect(branding.logoUrl).toBe('/assets/tenants/cgcom/logo.png');
  });

  it('discards a malformed descriptor: no raw/partial tokens are applied (ES-01)', () => {
    const malformedDescriptor = {
      branding: {
        primaryColor: 42,
        name: {},
      },
      i18n: 'not-an-object',
    };
    const result = { ok: true, descriptor: malformedDescriptor } as unknown as TenantBrandingResult;

    const branding = resolveTenantBranding(result);

    expect(branding).toEqual(DEFAULT_EUDISTACK_BRANDING);
  });

  it('sanitizes tokens field by field: drops invalid CSS color values', () => {
    const result: TenantBrandingResult = {
      ok: true,
      descriptor: {
        branding: {
          primaryColor: '#ABCDEF',
          secondaryColor: 'javascript:alert(1)',
        },
      },
    };

    const branding = resolveTenantBranding(result);

    expect(branding.tokens['--brand-primary']).toBe('#ABCDEF');
    expect(branding.tokens['--brand-secondary']).toBe(DEFAULT_EUDISTACK_BRANDING.tokens['--brand-secondary']);
  });

  it('never throws even on a completely unexpected shape', () => {
    expect(() => resolveTenantBranding({ ok: true, descriptor: null as never })).not.toThrow();
  });
});
