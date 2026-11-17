/**
 * Rutas de los pasos del recorrido (design.md AD-8, AD-9): Comprobación,
 * Correo, Solicitudes, Datos y QR de una solicitud, y las pantallas sin
 * solicitud que obtener. La solicitud actual va en la ruta, con el
 * identificador opaco que da el servicio.
 */
export const ENTITLEMENT_PATH = 'entitlement';
export const EMAIL_PATH = 'email';
export const REQUESTS_PATH = 'requests';
export const DONE_PATH = 'done';
export const NO_REQUESTS_PATH = 'no-requests';
export const REQUEST_UNAVAILABLE_PATH = 'request-unavailable';

/** Nombre del parámetro de ruta con el identificador de la solicitud. */
export const REQUEST_ID_PARAM = 'requestId';

/** Rutas, como las declara `app.routes.ts`, de Datos y QR de una solicitud. */
export const DATA_ROUTE = `${REQUESTS_PATH}/:${REQUEST_ID_PARAM}/data`;
export const QR_ROUTE = `${REQUESTS_PATH}/:${REQUEST_ID_PARAM}/offer`;

/** Datos de la solicitud `requestId`. */
export function dataUrl(requestId: string): string[] {
  return ['/', REQUESTS_PATH, requestId, 'data'];
}

/** QR de la solicitud `requestId`. */
export function qrUrl(requestId: string): string[] {
  return ['/', REQUESTS_PATH, requestId, 'offer'];
}

/**
 * Primer segmento de las rutas que dependen del recorrido: las que protege
 * `journeyStepGuard`. Inicio, Ayuda, Error y las dos pantallas sin solicitud
 * que obtener no cuentan.
 */
export const JOURNEY_STEP_ROOTS: readonly string[] = [ENTITLEMENT_PATH, EMAIL_PATH, REQUESTS_PATH, DONE_PATH];
