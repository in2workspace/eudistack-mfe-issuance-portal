/** Longitud máxima admitida para la referencia de oferta (ES-01, fail-fast en la frontera). */
const MAX_REFERENCE_LENGTH = 2048;

/**
 * Valida la forma de la referencia de oferta devuelta por el proceso de
 * emisión: string no vacío, ≤ 2048 caracteres, parseable como URL absoluta
 * `https:` (ES-01). Función pura — no transforma el valor, solo comprueba
 * su forma.
 *
 * Solo `https:` (auditoría EUD-163, hallazgo W2): OID4VCI 1.0 §4.1 exige que
 * `credential_offer_uri` identifique un recurso recuperable vía HTTPS GET —
 * el esquema `openid-credential-offer:` es exclusivo de la URL de invocación
 * del wallet (ver `validateWalletInvocationBase`), nunca del recurso al que
 * apunta esta referencia. Aceptarlo aquí era más permisivo que la norma que
 * dice implementar.
 */
export function validateCredentialOfferReference(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_REFERENCE_LENGTH) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
