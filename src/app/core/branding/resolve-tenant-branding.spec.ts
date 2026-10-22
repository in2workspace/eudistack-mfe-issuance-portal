import { resolveTenantBranding } from './resolve-tenant-branding';
import { DEFAULT_EUDISTACK_BRANDING } from './tenant-branding.model';
import { PortalConfig, PortalConfigBranding } from '../api/generated/journey';

function configWith(branding: PortalConfigBranding, languages: string[] = ['es']): PortalConfig {
  return { branding, languages, texts: {}, support: {}, legal_links: {} };
}

describe('resolveTenantBranding', () => {
  it('returns the neutral default when there is no configuration (ES-01)', () => {
    expect(resolveTenantBranding(null)).toEqual(DEFAULT_EUDISTACK_BRANDING);
  });

  it('AC-01: takes the logo, colors and languages from GET /config', () => {
    const branding = resolveTenantBranding(
      configWith(
        {
          logo_url: '/assets/tenants/cgcom/logo.png',
          colors: { primary: '#003057', primary_contrast: '#ffffff', secondary: '#ffd100', secondary_contrast: '#003057' },
        },
        ['es', 'en'],
      ),
    );

    expect(branding.logoUrl).toBe('/assets/tenants/cgcom/logo.png');
    expect(branding.tokens['--brand-primary']).toBe('#003057');
    expect(branding.tokens['--brand-secondary']).toBe('#ffd100');
    expect(branding.defaultLanguage).toBe('es');
    expect(branding.supportedLanguages).toEqual(['es', 'en']);
  });

  it('falls back to the neutral value for each missing field', () => {
    const branding = resolveTenantBranding(configWith({}));

    expect(branding.logoUrl).toBe(DEFAULT_EUDISTACK_BRANDING.logoUrl);
    expect(branding.faviconUrl).toBe(DEFAULT_EUDISTACK_BRANDING.faviconUrl);
    expect(branding.tokens).toEqual(DEFAULT_EUDISTACK_BRANDING.tokens);
  });

  it('derives --brand-accent from primary when it is not near-white (typical tenant)', () => {
    const branding = resolveTenantBranding(
      configWith({ colors: { primary: '#003057', primary_contrast: '#ffffff', secondary: '#ffd100', secondary_contrast: '#003057' } }),
    );

    expect(branding.tokens['--brand-accent']).toBe('#003057');
    expect(branding.tokens['--brand-accent-contrast']).toBe('#ffffff');
  });

  it('falls back to secondary for --brand-accent when primary is near-white (CGCOM)', () => {
    const branding = resolveTenantBranding(
      configWith({ colors: { primary: '#ffffff', primary_contrast: '#46484C', secondary: '#F9B000', secondary_contrast: '#46484C' } }),
    );

    expect(branding.tokens['--brand-accent']).toBe('#F9B000');
    expect(branding.tokens['--brand-accent-contrast']).toBe('#46484C');
  });

  it('EC-03: ignores a color that is not hexadecimal and keeps the rest of the brand', () => {
    const branding = resolveTenantBranding(
      configWith({ logo_url: '/assets/tenants/cgcom/logo.png', colors: { primary: '#ABCDEF', secondary: 'javascript:alert(1)' } }),
    );

    expect(branding.tokens['--brand-primary']).toBe('#ABCDEF');
    expect(branding.tokens['--brand-secondary']).toBe(DEFAULT_EUDISTACK_BRANDING.tokens['--brand-secondary']);
    expect(branding.logoUrl).toBe('/assets/tenants/cgcom/logo.png');
  });

  it('ignores color keys outside the allow-list', () => {
    const branding = resolveTenantBranding(configWith({ colors: { background: '#000000' } }));

    expect(branding.tokens).toEqual(DEFAULT_EUDISTACK_BRANDING.tokens);
  });

  it('never throws even on a completely unexpected shape', () => {
    expect(() => resolveTenantBranding({ branding: null, languages: null } as unknown as PortalConfig)).not.toThrow();
  });
});
