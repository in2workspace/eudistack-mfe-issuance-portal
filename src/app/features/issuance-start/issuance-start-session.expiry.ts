import { IssuanceStartSession } from './issuance-start-session.model';

/**
 * Ventana de validez de la sesión de arranque: 15 minutos, absoluta desde
 * `redirectedAt`, sin renovación deslizante (AD-2, NFR-S-164-01). Constante
 * de código — no se ofrece a los tenants alargarla (AD-5: no debilitar la
 * defensa por configuración).
 */
export const ISSUANCE_START_SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * `true` si `session` superó su ventana de validez en el instante `now`.
 * Comparación absoluta contra `expiresAt` — sin renovación deslizante. Una
 * sesión sin `expiresAt` (nunca llegó a `redirigida`) se considera expirada:
 * no hay ventana que aún esté vigente.
 */
export function isIssuanceStartSessionExpired(session: IssuanceStartSession, now: number): boolean {
  if (session.expiresAt === undefined) {
    return true;
  }
  return now > session.expiresAt;
}
