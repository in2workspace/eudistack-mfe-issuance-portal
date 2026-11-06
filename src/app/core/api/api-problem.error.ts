/** `type` cuando la respuesta de error no trae un Problem. */
export const UNEXPECTED_ERROR = 'unexpected_error';
/** `type` cuando no hubo respuesta (red caída, petición cancelada). */
export const NETWORK_ERROR = 'network_error';
/** `type` del 410: el recorrido ya no está en curso o ha caducado. */
export const JOURNEY_CLOSED = 'journey_closed';
/** `type` del 409: el paso pedido no corresponde al recorrido. */
export const STEP_NOT_ALLOWED = 'step_not_allowed';
/** `type` del 503 de `POST /entitlement`: la fuente auténtica no respondió o respondió con error. */
export const AUTHENTIC_SOURCE_UNAVAILABLE = 'authentic_source_unavailable';

/**
 * Error tipado de cualquier llamada al servicio del portal de emisión. Las
 * pantallas deciden qué mostrar por `type` (design.md §3.1), nunca por el
 * texto ni el status.
 */
export class ApiProblemError extends Error {
  constructor(
    readonly type: string,
    readonly status: number,
    readonly title: string,
  ) {
    super(title);
    this.name = 'ApiProblemError';
  }
}
