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
/** `type` del 502 de la confirmación o de un código nuevo: la API de emisión rechazó la petición. */
export const ISSUANCE_REJECTED = 'issuance_rejected';
/** `type` del 503 de la confirmación o de un código nuevo: la API de emisión no respondió. */
export const ISSUANCE_UNAVAILABLE = 'issuance_unavailable';
/** `type` del 503 de la confirmación o de un código nuevo: no se pudo preparar el alta en el wallet; no hay oferta. */
export const ONBOARDING_UNAVAILABLE = 'onboarding_unavailable';
/** `type` del 409 de la confirmación o de un código nuevo: el titular ya recogió la atestación; el recorrido ha terminado. */
export const OFFER_NOT_RENEWABLE = 'offer_not_renewable';
/** `type` del 400 del envío del código: falta el correo. */
export const EMAIL_REQUIRED = 'email_required';
/** `type` del 400 del envío del código: el correo no tiene formato válido. */
export const EMAIL_INVALID = 'email_invalid';
/** `type` del 503 del envío del código: el correo no pudo enviarse; no cuenta como envío. */
export const EMAIL_UNAVAILABLE = 'email_unavailable';
/** `type` del 429 del envío del código: aún no han pasado 3 minutos desde el último (con `Retry-After`). */
export const RESEND_TOO_SOON = 'resend_too_soon';
/** `type` del 429 del envío del código: el recorrido ya envió 3 códigos (sin `Retry-After`). */
export const TOO_MANY_CODES = 'too_many_codes';
/** `type` del 429 del envío del código: 10 envíos desde el mismo origen en la última hora (con `Retry-After`). */
export const TOO_MANY_REQUESTS = 'too_many_requests';
/** `type` del 400 de la comprobación: el código no es correcto; gasta un intento. */
export const INVALID_CODE = 'invalid_code';
/** `type` del 400 de la comprobación: el código tiene más de 10 minutos o lo sustituyó otro. */
export const EXPIRED_CODE = 'expired_code';
/** `type` del 400 de la comprobación: 5 intentos fallidos con ese código. */
export const TOO_MANY_ATTEMPTS = 'too_many_attempts';

/**
 * Error tipado de cualquier llamada al servicio del portal de emisión. Las
 * pantallas deciden qué mostrar por `type` (design.md §3.1), nunca por el
 * texto ni el status. `retryAfterSeconds` es el `Retry-After` de la respuesta,
 * si lo trae (los 429 del envío del código).
 */
export class ApiProblemError extends Error {
  constructor(
    readonly type: string,
    readonly status: number,
    readonly title: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(title);
    this.name = 'ApiProblemError';
  }
}
