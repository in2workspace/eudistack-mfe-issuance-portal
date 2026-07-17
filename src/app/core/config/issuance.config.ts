import { environment } from '../../../environments/environment';

/** Fallback seguro cuando no hay destino de arranque configurado (AD-2, ES-02). */
const FALLBACK_ISSUANCE_START_URL = '#';

/**
 * Resuelve la URL de destino del CTA de arranque de emisión.
 *
 * Lee `environment.issuanceStartUrl` (runtime `env.js` en producción, patrón
 * de `certIdentifierUrl`). Si está ausente o vacía, devuelve el fallback
 * seguro `'#'` sin lanzar: hasta que EUD-164 configure la env var, el CTA
 * es un no-op y EUD-162 se despliega sola.
 */
export function resolveIssuanceStartUrl(): string {
  const configured = environment.issuanceStartUrl;
  return configured && configured.trim().length > 0 ? configured : FALLBACK_ISSUANCE_START_URL;
}
