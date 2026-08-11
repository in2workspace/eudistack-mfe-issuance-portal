import { CredentialOffer } from './credential-offer.model';

/**
 * Ventana de presentación de la oferta (AD-6, NFR-S-163-01): 10 min absolutos
 * desde la obtención, sin renovación deslizante. Constante de código, no
 * configurable por tenant — mismo criterio que el TTL de EUD-164 AD-2.
 */
export const CREDENTIAL_OFFER_PRESENTATION_TTL_MS = 10 * 60 * 1000;

/** Función pura — `now` inyectado para ser testeable en los límites (ES-03). */
export function isCredentialOfferExpired(offer: CredentialOffer, now: number): boolean {
  return now - offer.obtainedAt > CREDENTIAL_OFFER_PRESENTATION_TTL_MS;
}
