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
  /** EUD-164: el destino/modo de identificación configurado para el tenant no es válido o está ausente (ES-01/ES-02). */
  IdentificationConfigInvalid = 'IDENTIFICATION_CONFIG_INVALID',
  /** EUD-164: se eligió "Certificado Digital" sin una sesión de arranque en el contexto (ES-07). */
  StartSessionAbsent = 'START_SESSION_ABSENT',
  /** EUD-164: la sesión de arranque superó su ventana de validez absoluta antes del retorno (ES-03, NFR-S-164-01). */
  StartSessionExpired = 'START_SESSION_EXPIRED',
  /** EUD-164: la referencia de correlación del retorno ya se consumió una vez (AC-05, uso único). */
  ReturnAlreadyConsumed = 'RETURN_ALREADY_CONSUMED',
  Unknown = 'UNKNOWN',
}