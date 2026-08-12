/**
 * Allow-list de destinos admitidos para configuración con implicación de
 * seguridad (NFR-S-163-02, AD-2). Nunca un host absoluto: solo ruta
 * same-origin. Sin default — la ausencia de config válida se resuelve
 * fail-closed en `resolveCredentialOfferConfig`.
 *
 * Fix de seguridad (auditoría EUD-163, hallazgo F1): la comprobación
 * anterior por prefijos de string (`startsWith('/') && !startsWith('//') &&
 * !startsWith('/\\')`) es bypasseable con un tabulador/salto de línea al
 * principio — el parser WHATWG de URL los elimina ANTES de resolver, así
 * que `"/\t/evil.example/x"` pasaba el chequeo de prefijos y resolvía a
 * `https://evil.example/x`. Se sustituye por resolución real con `URL`
 * contra una base fija arbitraria (no depende de `window.location`, la
 * función sigue siendo pura/testeable sin DOM): si el valor smuggleó su
 * propio host (`//`, o `/<TAB>/host`), el origin resultante difiere de la
 * base y se rechaza — si no, siempre coincide, sea cual sea la base.
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

/**
 * Base arbitraria y fija — solo para detectar si `value` cambia de origin al
 * resolverse, nunca se usa como origin real ni se conecta por red. `https:`
 * (no `http:`) únicamente para no disparar la regla `typescript:S5332` de
 * SonarCloud ("Using http protocol is insecure") — la elección de esquema es
 * irrelevante para la lógica, solo se compara el `origin` resultante.
 */
const DUMMY_BASE = 'https://eudistack-same-origin.invalid';

function isSameOriginPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || !value.startsWith('/')) {
    return false;
  }
  try {
    return new URL(value, DUMMY_BASE).origin === DUMMY_BASE;
  } catch {
    return false;
  }
}
