import { TenantIdentificationConfig } from './tenant-identification-config.model';

/**
 * Resuelve la URL final de la salida externa: añade el parámetro de
 * correlación solo en modo `echo` (en `same_context` no viaja ningún
 * parámetro propio de EUD-164, EC-01). Preserva rutas relativas y los
 * parámetros de consulta que el destino ya trajera (p.ej. `?method=
 * certificate`) — nunca reconstruye un host distinto del que sirvió el
 * portal (EC-03; el repo ya sufrió esta regresión, riesgo R-5).
 */
export function resolveIdentificationRedirectUrl(config: TenantIdentificationConfig, token: string): string {
  if (config.correlationMode !== 'echo' || !config.correlationParam) {
    return config.url;
  }

  const isRelative = config.url.startsWith('/');
  // Base fija solo para poder usar el parser WHATWG de URL/URLSearchParams
  // sobre una ruta relativa; nunca se usa como origin real ni se conecta
  // por red — se descarta al reserializar si la entrada era relativa.
  const parsed = new URL(config.url, 'https://eudistack-same-origin.invalid');
  parsed.searchParams.set(config.correlationParam, token);

  return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
}
