import { validateCredentialOfferEndpoint, validateWalletInvocationBase } from './validate-credential-offer-endpoint';

describe('validateCredentialOfferEndpoint', () => {
  it('acepta una ruta same-origin normal', () => {
    expect(validateCredentialOfferEndpoint('/issuance-portal/api/bootstrap')).toBe(true);
  });

  it('rechaza un host absoluto', () => {
    expect(validateCredentialOfferEndpoint('https://evil.example/bootstrap')).toBe(false);
  });

  it('rechaza protocol-relative (//)', () => {
    expect(validateCredentialOfferEndpoint('//evil.example/bootstrap')).toBe(false);
  });

  it('rechaza backslash-relative (/\\)', () => {
    expect(validateCredentialOfferEndpoint('/\\evil.example/bootstrap')).toBe(false);
  });

  it('rechaza undefined/vacío/no-string', () => {
    expect(validateCredentialOfferEndpoint(undefined)).toBe(false);
    expect(validateCredentialOfferEndpoint('')).toBe(false);
    expect(validateCredentialOfferEndpoint(42)).toBe(false);
  });

  // Auditoría de seguridad EUD-163, hallazgo F1: el parser WHATWG de URL
  // elimina tabulador/CR/LF ANTES de resolver — un chequeo por prefijos de
  // string ("//") no los detecta, pero "/\t/evil.example" se convertía en
  // "//evil.example" tras el strip y resolvía a otro origin. Estos 3
  // vectores son los que de verdad rompían el allow-list anterior.
  it('rechaza el bypass del allow-list vía tabulador (F1)', () => {
    expect(validateCredentialOfferEndpoint('/\t/evil.example/bootstrap')).toBe(false);
  });

  it('rechaza el bypass del allow-list vía salto de línea (F1)', () => {
    expect(validateCredentialOfferEndpoint('/\n/evil.example/bootstrap')).toBe(false);
  });

  it('rechaza el bypass del allow-list vía retorno de carro (F1)', () => {
    expect(validateCredentialOfferEndpoint('/\r/evil.example/bootstrap')).toBe(false);
  });

  it('acepta una ruta con tabulador que NO smugglea un host (sigue siendo same-origin)', () => {
    // "/\tevil.example/x" (sin segunda barra) no cambia de origin al resolverse
    // — sigue siendo una ruta en el propio origin, aunque tenga un carácter raro.
    expect(validateCredentialOfferEndpoint('/\tevil.example/bootstrap')).toBe(true);
  });
});

describe('validateWalletInvocationBase', () => {
  it('acepta el literal exacto del esquema openid-credential-offer://', () => {
    expect(validateWalletInvocationBase('openid-credential-offer://')).toBe(true);
  });

  it('acepta una ruta same-origin normal', () => {
    expect(validateWalletInvocationBase('/wallet/protocol/callback')).toBe(true);
  });

  it('rechaza un host absoluto', () => {
    expect(validateWalletInvocationBase('https://evil.example/callback')).toBe(false);
  });

  it('rechaza el bypass del allow-list vía tabulador (F1)', () => {
    expect(validateWalletInvocationBase('/\t/evil.example/callback')).toBe(false);
  });
});
