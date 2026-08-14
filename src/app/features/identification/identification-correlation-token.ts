/**
 * Genera la referencia de correlación del round-trip de identificación:
 * 16 bytes de un CSPRNG (`crypto.getRandomValues`) en Base64 URL-safe — 128
 * bits de entropía (NFR-S-164-02; ancla OWASP ASVS V3.2.2, RFC 6749 §10.10).
 * Mismo patrón que `generateSessionId()` de `issuance-start.service.ts`.
 */
export function createCorrelationToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
