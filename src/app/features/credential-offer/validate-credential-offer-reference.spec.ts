import { validateCredentialOfferReference } from './validate-credential-offer-reference';

describe('validateCredentialOfferReference', () => {
  it('acepta una URL https válida', () => {
    expect(validateCredentialOfferReference('https://issuer.example/credential-offer/abc123')).toBe(true);
  });

  it('rechaza undefined/vacío/no-string', () => {
    expect(validateCredentialOfferReference(undefined)).toBe(false);
    expect(validateCredentialOfferReference('')).toBe(false);
    expect(validateCredentialOfferReference(42)).toBe(false);
  });

  it('rechaza una cadena no parseable como URL', () => {
    expect(validateCredentialOfferReference('not-a-valid-uri')).toBe(false);
  });

  it('rechaza más de 2048 caracteres', () => {
    const long = 'https://issuer.example/' + 'x'.repeat(2048);
    expect(validateCredentialOfferReference(long)).toBe(false);
  });

  // Auditoría de seguridad EUD-163, hallazgo W2: OID4VCI 1.0 §4.1 exige que
  // credential_offer_uri identifique un recurso recuperable vía HTTPS GET —
  // el esquema openid-credential-offer:// es solo para la URL de invocación
  // del wallet (validateWalletInvocationBase), nunca para esta referencia.
  it('rechaza el esquema openid-credential-offer:// (solo válido para la invocación del wallet, no para la referencia)', () => {
    expect(validateCredentialOfferReference('openid-credential-offer://issuer.example/offer/1')).toBe(false);
  });

  it('rechaza otros esquemas no http(s)', () => {
    expect(validateCredentialOfferReference('http://issuer.example/offer/1')).toBe(false);
    expect(validateCredentialOfferReference('ftp://issuer.example/offer/1')).toBe(false);
    expect(validateCredentialOfferReference('javascript:alert(1)')).toBe(false);
  });
});
