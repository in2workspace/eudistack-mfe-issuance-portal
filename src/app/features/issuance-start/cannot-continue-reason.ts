/** Por qué la pantalla QR no puede presentar la oferta. Cada valor tiene su texto en `issuanceEntryPoint.cannotContinue.*`. */
export enum CannotContinueReason {
  /** EUD-163: la oferta de credencial no está disponible (respuesta inválida, error del emisor o caducada). */
  OfferUnavailable = 'OFFER_UNAVAILABLE',
  /** EUD-163: se agotó el plazo de espera de la oferta (NFR-P-163-01) sin respuesta. */
  OfferTimeout = 'OFFER_TIMEOUT',
}
