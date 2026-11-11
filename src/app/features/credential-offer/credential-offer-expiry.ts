import { OfferAddress } from './credential-offer.model';

/**
 * Segundos enteros que le quedan a la dirección (0 si ya ha caducado). La
 * caducidad es la que da el servicio (`onboarding_expires_at` o
 * `expires_at`), no una ventana fija del navegador. `now` se inyecta para
 * poder probar los límites.
 */
export function secondsUntilExpiry(address: OfferAddress, now: number): number {
  return Math.max(Math.ceil((address.expiresAt - now) / 1000), 0);
}

export function isOfferAddressExpired(address: OfferAddress, now: number): boolean {
  return secondsUntilExpiry(address, now) === 0;
}

/** Cuenta atrás «mm:ss» (prd.md FR-06, wireframes QR). */
export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
