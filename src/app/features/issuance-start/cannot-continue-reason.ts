export enum CannotContinueReason {
  NotCorrelated = 'NOT_CORRELATED',
  ConfigAbsent = 'CONFIG_ABSENT',
  EntryPointInvalid = 'ENTRY_POINT_INVALID',
  EntryPointStartFailed = 'ENTRY_POINT_START_FAILED',
  EntryPointTimeout = 'ENTRY_POINT_TIMEOUT',
  /** EUD-163: la oferta de credencial no está disponible (config ausente, respuesta inválida o error del emisor). */
  OfferUnavailable = 'OFFER_UNAVAILABLE',
  /** EUD-163: se agotó el plazo de espera de la oferta (NFR-P-163-01) sin respuesta. */
  OfferTimeout = 'OFFER_TIMEOUT',
  Unknown = 'UNKNOWN',
}