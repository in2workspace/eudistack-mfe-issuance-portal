import { validatePortalConfig } from './validate-portal-config';

describe('validatePortalConfig', () => {
  const valid = {
    branding: { logo_url: '/assets/tenants/cgcom/logo.png', colors: { primary: '#ffffff' } },
    languages: ['es', 'en'],
    texts: { es: { 'portal.title': 'Portal de emisión' } },
    support: { email: 'soporte@example.org' },
    legal_links: { privacy: 'https://example.org/privacy' },
  };

  it('accepts a configuration with every required field', () => {
    expect(validatePortalConfig(valid)).toEqual(valid);
  });

  it.each(['branding', 'languages', 'texts', 'support', 'legal_links'])('ES-03: rejects a configuration without %s', (field) => {
    const raw: Record<string, unknown> = { ...valid };
    delete raw[field];

    expect(validatePortalConfig(raw)).toBeNull();
  });

  it('ES-03: rejects a configuration without any language', () => {
    expect(validatePortalConfig({ ...valid, languages: [] })).toBeNull();
    expect(validatePortalConfig({ ...valid, languages: ['', 3] })).toBeNull();
  });

  it('keeps only the valid languages, trimmed', () => {
    expect(validatePortalConfig({ ...valid, languages: [' en ', '', 4] })?.languages).toEqual(['en']);
  });

  it.each([null, 'config', [], 42])('ES-03: rejects a body that is not an object (%p)', (raw) => {
    expect(validatePortalConfig(raw)).toBeNull();
  });
});
