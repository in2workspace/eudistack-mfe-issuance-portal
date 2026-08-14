/**
 * Configuración por tenant del destino de identificación gestionado por esta
 * Story (carril "Certificado Digital", EUD-164 — decisión de PO 2026-08-14).
 * `url`: destino same-origin o `https://…` (validado por `validateIdentificationUrl`).
 * `correlationMode`: si el destino devuelve (`echo`) o no (`same_context`) la
 * referencia de correlación en el retorno. `correlationParam`: nombre del
 * parámetro de consulta que porta la referencia — solo exigido en modo `echo`.
 */
export interface TenantIdentificationConfig {
  url: string;
  correlationMode: IdentificationCorrelationMode;
  correlationParam?: string;
}

export type IdentificationCorrelationMode = 'echo' | 'same_context';

/** Allow-list — ningún otro valor de `correlationMode` es válido (fail-closed, AD-5). */
export const IDENTIFICATION_CORRELATION_MODES: readonly IdentificationCorrelationMode[] = [
  'echo',
  'same_context',
];

export type TenantIdentificationConfigFailureReason =
  | 'config_absent'
  | 'identification_url_invalid'
  | 'correlation_mode_invalid'
  | 'correlation_param_absent';

export type TenantIdentificationConfigResult =
  | { ok: true; config: TenantIdentificationConfig }
  | { ok: false; reason: TenantIdentificationConfigFailureReason };
