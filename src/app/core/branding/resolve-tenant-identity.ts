/**
 * Resuelve la identidad de tenant desde el subdominio (`window.location.hostname`),
 * con override de `window['env']['tenant']` para dev/local (AD-3). Función pura:
 * sin caché de módulo ni estado entre invocaciones — cada llamada re-resuelve
 * desde cero, base del aislamiento entre tenants (EC-05, R-2).
 *
 * Con ella se pide el `theme.json` del tenant (marca e idiomas). La
 * configuración propia del portal (`GET /config`) la resuelve el servicio por
 * el host.
 *
 * @returns el candidato a tenant, o `null` si no hay override y el hostname
 *   no tiene subdominio (ES-03) — nunca adivina ni reutiliza un tenant previo.
 */
export function resolveTenantIdentity(
  location: Pick<Location, 'hostname'>,
  env: { tenant?: string },
): string | null {
  const override = env.tenant?.trim();
  if (override) {
    return override;
  }

  const segments = location.hostname.toLowerCase().split('.');
  if (segments.length < 2) {
    return null;
  }

  const candidate = segments[0].trim();
  return candidate.length > 0 ? candidate : null;
}
