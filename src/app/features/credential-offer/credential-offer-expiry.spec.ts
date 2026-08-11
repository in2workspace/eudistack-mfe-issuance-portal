import { CREDENTIAL_OFFER_PRESENTATION_TTL_MS, isCredentialOfferExpired } from './credential-offer-expiry';

describe('isCredentialOfferExpired', () => {
  const obtainedAt = 1_000_000;

  it('a 599 s desde la obtención NO ha expirado (NFR-S-163-01)', () => {
    const now = obtainedAt + 599_000;

    expect(isCredentialOfferExpired({ reference: 'ref', obtainedAt }, now)).toBe(false);
  });

  it('a 601 s desde la obtención SÍ ha expirado (ES-03, NFR-S-163-01)', () => {
    const now = obtainedAt + 601_000;

    expect(isCredentialOfferExpired({ reference: 'ref', obtainedAt }, now)).toBe(true);
  });

  it('exactamente en el límite de la ventana (600 s) todavía no expira — sin renovación deslizante', () => {
    const now = obtainedAt + CREDENTIAL_OFFER_PRESENTATION_TTL_MS;

    expect(isCredentialOfferExpired({ reference: 'ref', obtainedAt }, now)).toBe(false);
  });

  it('la ventana es de 10 minutos exactos', () => {
    expect(CREDENTIAL_OFFER_PRESENTATION_TTL_MS).toBe(10 * 60 * 1000);
  });
});
