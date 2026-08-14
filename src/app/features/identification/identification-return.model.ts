import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';

/**
 * Resultado del retorno de identificación (AD-7 — decisión de PO 2026-08-14
 * sobre el alcance de NFR-S-01). Tri-estado, no boolean, porque
 * `UserDataComponent` es alcanzable por dos caminos disjuntos: el retorno
 * real del carril "Certificado Digital" (`correlated`/`rejected`) y la
 * navegación interna de los otros 4 métodos, que esta Story no evalúa
 * (`out_of_scope`) — un boolean no podría distinguir "rechazado" de
 * "esta Story no opina" sin degenerar en un `?? true` implícito.
 */
export type IdentificationReturnOutcome = 'correlated' | 'rejected' | 'out_of_scope';

/**
 * Decisión que produce `validateIdentificationReturn` — solo se evalúa
 * cuando SÍ hay un retorno del carril `certificate` que correlacionar; por
 * eso no incluye `out_of_scope` (ese es el estado inicial de
 * `IdentificationReturnService`, antes de haber algo que evaluar).
 */
export type IdentificationReturnDecision =
  | { outcome: 'correlated'; session: IssuanceStartSession }
  | { outcome: 'rejected'; reason: CannotContinueReason };
