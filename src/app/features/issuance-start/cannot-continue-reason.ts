/**
 * Razones cerradas por las que la pantalla informativa no puede continuar (FR-11).
 *
 * Seam para EUD-163/EUD-164: esas Stories emiten razones de este enum. Cualquier
 * valor recibido fuera del enum colapsa a `Unknown` (ES-01) — nunca se propaga
 * causa cruda a la vista.
 */
export enum CannotContinueReason {
  Unknown = 'unknown',
}

const KNOWN_REASONS: readonly string[] = Object.values(CannotContinueReason);

/** Colapsa cualquier valor fuera del enum cerrado a `Unknown` (ES-01). */
export function toCannotContinueReason(value: unknown): CannotContinueReason {
  return typeof value === 'string' && KNOWN_REASONS.includes(value)
    ? (value as CannotContinueReason)
    : CannotContinueReason.Unknown;
}
