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
 *   Solo se acepta si es `https:` y del wallet del tenant (el origen de
 *   `wallet_url`), como dice el contrato: llega al QR, al enlace y a
 *   `location.assign`, que no pasa por el saneador de Angular (review B1).
 * - Sin ella, la dirección del wallet del tenant con el valor del parámetro
 *   `credential_offer_uri` del enlace recibido, sin modificarlo, codificado
 *   como URL, hasta `expires_at`.
 *
 * Devuelve `null` si no se puede dar una dirección que funcione (ac.md
 * ES-03): la dirección de alta no es del wallet del tenant o no trae su
 * caducidad, falta el parámetro o `wallet_url`, o la caducidad no es una
 * fecha. Nunca construye la dirección del wallet si la oferta trae
 * `onboarding_url`.
 */
export function resolveOfferAddress(offer: Offer, walletUrl: string | null | undefined): OfferAddress | null {
  if (offer.onboarding_url) {
    if (!offer.onboarding_expires_at || !isWalletAddress(offer.onboarding_url, walletUrl)) {
      return null;
    }
    return withExpiry(offer.onboarding_url, offer.onboarding_expires_at);
  }
  const offerUri = credentialOfferUri(offer.credential_offer_uri);
  if (!offerUri || !walletUrl) {
    return null;
  }
  const wallet = withoutTrailingSlashes(walletUrl);
  return withExpiry(`${wallet}/${WALLET_CALLBACK_PATH}?${CREDENTIAL_OFFER_URI}=${encodeURIComponent(offerUri)}`, offer.expires_at);
}

/** `https:` y en el mismo origen que el wallet del tenant. */
function isWalletAddress(address: string, walletUrl: string | null | undefined): boolean {
  const url = parseUrl(address);
  const wallet = walletUrl ? parseUrl(walletUrl) : null;
  return url?.protocol === 'https:' && wallet !== null && url.origin === wallet.origin;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Sin expresión regular, para no depender de la vuelta atrás con entradas largas. */
function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') {
    end--;
  }
  return url.slice(0, end);
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
