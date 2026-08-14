/**
 * Allow-list de destinos admitidos para el destino de identificación
 * configurado por tenant (NFR-S-01, AD-5). Dos formas admitidas: ruta
 * same-origin (`/…`) o URL absoluta `https://…`. Rechaza cualquier otra cosa
 * — `javascript:`, `data:`, `http:`, protocolo-relativa (`//host/x`) y cadena
 * vacía — sin sustituir por un destino por defecto (fail-closed).
 *
 * Reutiliza el patrón auditado en `validate-credential-offer-endpoint.ts`
 * (EUD-163, hallazgo F1): un chequeo de prefijos de string
 * (`startsWith('/') && !startsWith('//')`) es bypasseable con un
 * tabulador/salto de línea al principio, que el parser WHATWG de `URL`
 * elimina ANTES de resolver (`"/\t/evil.example/x"` pasaría el prefijo y
 * resolvería a `https://evil.example/x`). Aquí se resuelve siempre con
 * `URL` contra una base fija arbitraria y se compara el `origin` resultante
 * — no depende de `window.location`, sigue siendo puro y testeable sin DOM.
 */
export function validateIdentificationUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  if (value.startsWith('/')) {
    return isSameOriginPath(value);
  }
  return isAbsoluteHttpsUrl(value);
}

/** Base arbitraria y fija — nunca se usa como origin real ni se conecta por red. */
const DUMMY_BASE = 'https://eudistack-same-origin.invalid';

function isSameOriginPath(value: string): boolean {
  try {
    return new URL(value, DUMMY_BASE).origin === DUMMY_BASE;
  } catch {
    return false;
  }
}

function isAbsoluteHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
