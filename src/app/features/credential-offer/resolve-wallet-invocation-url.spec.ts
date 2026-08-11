import { resolveWalletInvocationUrl } from './resolve-wallet-invocation-url';

describe('resolveWalletInvocationUrl', () => {
  it('absolutiza una ruta same-origin contra el origin dado (AC-02)', () => {
    const result = resolveWalletInvocationUrl('https://issuer.example/offer/1', '/wallet/protocol/callback', 'https://cgcom.stg.eudistack.net');

    expect(result.url).toBe(
      'https://cgcom.stg.eudistack.net/wallet/protocol/callback?credential_offer_uri=' +
        encodeURIComponent('https://issuer.example/offer/1'),
    );
  });

  it('no absolutiza el esquema openid-credential-offer:// (ya es una URI completa)', () => {
    const result = resolveWalletInvocationUrl('https://issuer.example/offer/1', 'openid-credential-offer://', 'https://cgcom.stg.eudistack.net');

    expect(result.url.startsWith('openid-credential-offer://')).toBe(true);
    expect(result.url).not.toContain('cgcom.stg.eudistack.net');
  });

  it('añade el separador correcto cuando la base ya trae query params previos', () => {
    const result = resolveWalletInvocationUrl('ref', '/wallet/callback?foo=bar', 'https://origin.example');

    expect(result.url).toBe('https://origin.example/wallet/callback?foo=bar&credential_offer_uri=ref');
  });

  it('QR y enlace comparten el mismo valor calculado — mismo resultado en llamadas idénticas (AC-02, estructural)', () => {
    const a = resolveWalletInvocationUrl('ref-1', '/wallet/protocol/callback', 'https://origin.example');
    const b = resolveWalletInvocationUrl('ref-1', '/wallet/protocol/callback', 'https://origin.example');

    expect(a).toEqual(b);
  });

  it('reporta la longitud codificada — 1200 caracteres resuelve dentro del límite admitido (NFR-U-163-01)', () => {
    const reference = 'x'.repeat(1200 - 'https://o.example/wallet/protocol/callback?credential_offer_uri='.length);
    const result = resolveWalletInvocationUrl(reference, '/wallet/protocol/callback', 'https://o.example');

    expect(result.length).toBeLessThanOrEqual(1200);
  });

  it('una referencia más larga supera el límite admitido — la degradación (ES-06) la decide el service, no esta función', () => {
    const reference = 'x'.repeat(1300);
    const result = resolveWalletInvocationUrl(reference, '/wallet/protocol/callback', 'https://o.example');

    expect(result.length).toBeGreaterThan(1200);
  });
});
