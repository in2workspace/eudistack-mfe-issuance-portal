import { ACR_BY_LEVEL, DEFAULT_ASSURANCE_LEVEL, acrClaims, buildOidcConfig, withScope } from './oidc-config';

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

  it('AC-29: the static configuration carries no level: each authorize adds the one of the tenant', () => {
    expect(config.customParamsAuthRequest).toBeUndefined();
    expect(DEFAULT_ASSURANCE_LEVEL).toBe('high');
  });

  it('AC-29: acrClaims asks for the acr of the level as an essential claim of the ID Token', () => {
    expect(JSON.parse(acrClaims('high'))).toEqual({ id_token: { acr: { essential: true, value: 'http://eidas.europa.eu/LoA/high' } } });
    expect(JSON.parse(acrClaims('substantial'))).toEqual({
      id_token: { acr: { essential: true, value: 'http://eidas.europa.eu/LoA/substantial' } },
    });
    expect(ACR_BY_LEVEL).toEqual({ high: 'http://eidas.europa.eu/LoA/high', substantial: 'http://eidas.europa.eu/LoA/substantial' });
  });

  it('keeps PKCE on, no user info call, no silent renewal and the history cleanup', () => {
    expect(config.disablePkce).toBeUndefined();
    expect(config.autoUserInfo).toBe(false);
    expect(config.silentRenew).toBeUndefined();
    expect(config.historyCleanupOff).toBe(false);
  });

  it('renews with the Refresh Token only, tolerating an ID Token of 60 s and a refresh without nonce', () => {
    expect(config.useRefreshToken).toBe(true);
    expect(config.silentRenew).toBeUndefined();
    expect(config.triggerRefreshWhenIdTokenExpired).toBe(false);
    expect(config.ignoreNonceAfterRefresh).toBe(true);
  });

  it('AC-02: the library does not navigate after the return: the callback route goes to the step', () => {
    expect(config.triggerAuthorizationResultEvent).toBe(true);
  });

  it('refuses to build a configuration without a tenant', () => {
    expect(() => buildOidcConfig('', 'https://sandbox.example')).toThrow();
  });
});

describe('withScope', () => {
  const url = 'https://cgcom.example/verifier/oidc/authorize?client_id=c&scope=openid%20profile&state=s&claims=%7B%7D';

  it('AC-13: adds the login attestation scope to the scope and keeps every other parameter', () => {
    const result = new URL(withScope(url, 'doctorid'));

    expect(result.searchParams.getAll('scope')).toEqual(['openid profile doctorid']);
    expect(result.searchParams.get('client_id')).toBe('c');
    expect(result.searchParams.get('state')).toBe('s');
    expect(result.searchParams.get('claims')).toBe('{}');
  });

  it('AC-13: leaves the URL as it is without a scope or when it already carries it', () => {
    expect(withScope(url, undefined)).toBe(url);
    expect(withScope(url, '')).toBe(url);
    expect(withScope(url, 'profile')).toBe(url);
  });
});
