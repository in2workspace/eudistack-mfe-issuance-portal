import { buildOidcConfig, REQUIRED_ACR } from './oidc-config';

describe('buildOidcConfig', () => {
  const config = buildOidcConfig('sandbox', 'https://sandbox.example');

  it('AC-01: is the public client of the tenant on the Verifier of the same origin', () => {
    expect(config.authority).toBe('https://sandbox.example/verifier');
    expect(config.clientId).toBe('issuance-portal-sandbox');
    expect(config.redirectUrl).toBe('https://sandbox.example/issuance-portal/callback');
    expect(config.postLogoutRedirectUri).toBe('https://sandbox.example/issuance-portal/');
    expect(config.responseType).toBe('code');
    expect(config.scope).toBe('openid profile email personal_administrative_number');
  });

  it('AC-01: asks for the high level of assurance as an essential claim of the ID Token', () => {
    expect(JSON.parse(String(config.customParamsAuthRequest?.['claims']))).toEqual({
      id_token: { acr: { essential: true, value: 'http://eidas.europa.eu/LoA/high' } },
    });
    expect(REQUIRED_ACR).toBe('http://eidas.europa.eu/LoA/high');
  });

  it('keeps PKCE on, no user info call, no silent renewal and the history cleanup', () => {
    expect(config.disablePkce).toBeUndefined();
    expect(config.autoUserInfo).toBe(false);
    expect(config.silentRenew).toBeUndefined();
    expect(config.historyCleanupOff).toBe(false);
  });

  it('refuses to build a configuration without a tenant', () => {
    expect(() => buildOidcConfig('', 'https://sandbox.example')).toThrow();
  });
});
