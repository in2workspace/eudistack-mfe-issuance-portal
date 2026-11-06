/**
 * Dirección que llevan a la vez el QR, el botón para abrir el wallet y la caja
 * para copiar (design.md §3.3), con el momento en que caduca: la dirección de
 * alta tal cual con su caducidad, o la del wallet del tenant construida con
 * el enlace de la oferta, con la caducidad de la oferta.
 */
export interface OfferAddress {
  url: string;
  /** Milisegundos desde la época (`Date.now()`) en que la dirección deja de servir. */
  expiresAt: number;
}
