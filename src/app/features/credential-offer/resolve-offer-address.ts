import { Offer } from '../../core/api/generated/journey';
import { OfferAddress } from './credential-offer.model';

/** Parámetro del enlace `openid-credential-offer://` con la dirección de la oferta. */
const CREDENTIAL_OFFER_URI = 'credential_offer_uri';
/** Ruta del wallet que recibe la oferta por ese mismo parámetro (`protocol-callback.page.ts`). */
const WALLET_CALLBACK_PATH = 'protocol/callback';

/**
 * Dirección del QR para una oferta del servicio (design.md §3.3, ac.md
 * AC-02 y AC-04):
 *
 * - Con `onboarding_url` (el tenant usa el alta con ticket), esa dirección
 *   tal cual, sin construir ni añadir nada, hasta `onboarding_expires_at`.
 * - Sin ella, la dirección del wallet del tenant con el valor del parámetro
 *   `credential_offer_uri` del enlace recibido, sin modificarlo, codificado
 *   como URL, hasta `expires_at`.
 *
 * Devuelve `null` si no se puede dar una dirección que funcione (ac.md
 * ES-03): falta el parámetro o `wallet_url`, o la caducidad no es una fecha.
 * Nunca construye la dirección del wallet si la oferta trae `onboarding_url`.
 */
export function resolveOfferAddress(offer: Offer, walletUrl: string | null | undefined): OfferAddress | null {
  if (offer.onboarding_url) {
    return withExpiry(offer.onboarding_url, offer.onboarding_expires_at ?? offer.expires_at);
  }
  const offerUri = credentialOfferUri(offer.credential_offer_uri);
  if (!offerUri || !walletUrl) {
    return null;
  }
  const wallet = walletUrl.replace(/\/+$/, '');
  return withExpiry(`${wallet}/${WALLET_CALLBACK_PATH}?${CREDENTIAL_OFFER_URI}=${encodeURIComponent(offerUri)}`, offer.expires_at);
}

function credentialOfferUri(link: string): string | null {
  const query = link.indexOf('?');
  if (query < 0) {
    return null;
  }
  return new URLSearchParams(link.slice(query + 1)).get(CREDENTIAL_OFFER_URI) || null;
}

function withExpiry(url: string, expiresAt: string): OfferAddress | null {
  const time = Date.parse(expiresAt);
  return Number.isNaN(time) ? null : { url, expiresAt: time };
}
