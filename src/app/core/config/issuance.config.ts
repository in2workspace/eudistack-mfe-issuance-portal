/**
 * Resuelve la URL de destino del CTA de arranque de emisión: el Portal de
 * Identificación con certificado FNMT (nginx `location ^~ /cert/`).
 *
 * Ruta relativa a propósito (AD-2): nginx sirve `/cert/` de forma idéntica
 * bajo cualquier subdominio de tenant, así que una URL same-origin preserva
 * el tenant actual sin necesidad de leer/reconstruir un host — a diferencia
 * de la versión previa (`environment.certIdentifierUrl`), que estaba fijada
 * al host de un único tenant (R-5, bug reportado en dev con tenant "dome").
 */
export function resolveIssuanceStartUrl(): string {
  return '/cert/';
}
