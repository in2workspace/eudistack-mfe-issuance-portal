/** Longitud máxima admitida para la referencia de oferta (ES-01, fail-fast en la frontera). */
const MAX_REFERENCE_LENGTH = 2048;

/**
 * Valida la forma de la referencia de oferta devuelta por el proceso de
 * emisión: string no vacío, ≤ 2048 caracteres, parseable como URL absoluta
 * `https:` o como URI con esquema `openid-credential-offer:` (ES-01).
 * Función pura — no transforma el valor, solo comprueba su forma.
 */
export function validateCredentialOfferReference(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_REFERENCE_LENGTH) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'openid-credential-offer:';
  } catch {
    return false;
  }
}
