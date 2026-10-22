/** `type` cuando la respuesta de error no trae un Problem. */
export const UNEXPECTED_ERROR = 'unexpected_error';
/** `type` cuando no hubo respuesta (red caída, petición cancelada). */
export const NETWORK_ERROR = 'network_error';

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
