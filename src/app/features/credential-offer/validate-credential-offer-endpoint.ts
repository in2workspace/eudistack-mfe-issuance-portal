/**
 * Allow-list de destinos admitidos para configuración con implicación de
 * seguridad (NFR-S-163-02, AD-2). Nunca un host absoluto: solo ruta
 * same-origin (empieza por `/`, nunca por `//` ni `/\`, que el navegador
 * podría interpretar como protocol-relative). Sin default — la ausencia de
 * config válida se resuelve fail-closed en `resolveCredentialOfferConfig`.
 */
export function validateCredentialOfferEndpoint(value: unknown): value is string {
  return isSameOriginPath(value);
}

/**
 * Igual que `validateCredentialOfferEndpoint`, pero admite además el literal
 * exacto del esquema estándar de invocación de wallet (OID4VCI 1.0 §4.1).
 */
export function validateWalletInvocationBase(value: unknown): value is string {
  if (value === 'openid-credential-offer://') {
    return true;
  }
  return isSameOriginPath(value);
}

function isSameOriginPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
  );
}
