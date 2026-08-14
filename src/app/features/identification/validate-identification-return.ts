import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { isIssuanceStartSessionExpired } from '../issuance-start/issuance-start-session.expiry';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { TenantIdentificationConfig } from './tenant-identification-config.model';
import { IdentificationReturnDecision } from './identification-return.model';

/**
 * Lectura mínima de los parámetros de consulta del retorno — misma forma
 * estructural que `URLSearchParams`, para que la función siga siendo pura
 * y testeable sin `window.location`.
 */
export interface IdentificationReturnParams {
  get(name: string): string | null;
}

export interface ValidateIdentificationReturnInput {
  session: IssuanceStartSession | null;
  params: IdentificationReturnParams;
  config: TenantIdentificationConfig;
  currentTenant: string;
  now: number;
}

/**
 * Gate único de NFR-S-01 (carril "Certificado Digital"). Función pura, sin
 * efectos (EC-02): solo evalúa, nunca sella `consumedAt`/`retomada` — eso
 * lo hace el caller (`IdentificationReturnService`) tras leer `correlated`.
 * Determinista: la misma entrada produce siempre la misma decisión.
 *
 * Nunca expone al titular el motivo técnico exacto (AC-04) — el aviso es
 * genérico independientemente de la razón interna — pero distingue
 * internamente los dos casos con causa propia y verificable
 * (`ReturnAlreadyConsumed`, `StartSessionExpired`); el resto de rechazos
 * colapsan en `NotCorrelated`, que es igual de cierto y no añade
 * información explotable.
 */
export function validateIdentificationReturn(
  input: ValidateIdentificationReturnInput,
): IdentificationReturnDecision {
  const { session, params, config, currentTenant, now } = input;

  if (!session) {
    return { outcome: 'rejected', reason: CannotContinueReason.NotCorrelated };
  }
  // AC-05 — uso único: `retomada` implica que ya se sella `consumedAt` en el
  // mismo turno síncrono (IdentificationReturnService), así que este chequeo
  // por estado es suficiente y evita depender de dos campos redundantes.
  if (session.state === 'retomada') {
    return { outcome: 'rejected', reason: CannotContinueReason.ReturnAlreadyConsumed };
  }
  if (session.state !== 'redirigida' || session.redirectedMethod !== 'certificate') {
    return { outcome: 'rejected', reason: CannotContinueReason.NotCorrelated };
  }
  // AC-07 — aislamiento por tenant: comparación explícita, nunca se asume.
  if (session.tenant !== currentTenant) {
    return { outcome: 'rejected', reason: CannotContinueReason.NotCorrelated };
  }
  if (isIssuanceStartSessionExpired(session, now)) {
    return { outcome: 'rejected', reason: CannotContinueReason.StartSessionExpired };
  }
  if (config.correlationMode === 'echo') {
    const expected = session.correlationToken;
    const provided = config.correlationParam ? params.get(config.correlationParam) : null;
    // ES-04 — nunca se acepta "por compatibilidad" ante ausencia de la referencia.
    if (!expected || !provided || provided !== expected) {
      return { outcome: 'rejected', reason: CannotContinueReason.NotCorrelated };
    }
  }
  // EC-01 — modo `same_context`: no se exige el parámetro, la correlación
  // se apoya en las comprobaciones de sesión/estado/tenant/TTL de arriba.

  return { outcome: 'correlated', session };
}
