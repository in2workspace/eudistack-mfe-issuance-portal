import { validatePortalConfig } from './validate-portal-config';

describe('validatePortalConfig', () => {
  const valid = {
    texts: { es: { 'portal.app_name': 'Portal de emisión de DoctorID' } },
    support: { email: 'soporte@example.org' },
    legal_links: {},
    wallet_url: 'https://cgcom.example/wallet',
  };

  it('accepts a configuration with every required field', () => {
    expect(validatePortalConfig(valid)).toEqual(valid);
  });

  it.each(['texts', 'support', 'legal_links', 'wallet_url'])('ES-02: rejects a configuration without %s', (field) => {
    const raw: Record<string, unknown> = { ...valid };
    delete raw[field];

    expect(validatePortalConfig(raw)).toBeNull();
  });

  it('ES-02: rejects an empty wallet_url', () => {
    expect(validatePortalConfig({ ...valid, wallet_url: '  ' })).toBeNull();
  });

  it('does not need brand or languages, which come from the theme.json', () => {
    expect(validatePortalConfig(valid)).not.toBeNull();
  });

  it.each([null, 'config', [], 42])('ES-02: rejects a body that is not an object (%p)', (raw) => {
    expect(validatePortalConfig(raw)).toBeNull();
  });
});
