/**
 * Oferta de credencial obtenida del proceso de emisión (EUD-3/EUD-4).
 * `reference` es el valor devuelto por el emisor, sin alterar (AC-03).
 */
export interface CredentialOffer {
  reference: string;
  obtainedAt: number;
}

/** Enlace que llevan a la vez el QR, el botón del wallet y la caja para copiar. */
export interface WalletInvocationUrl {
  url: string;
  length: number;
}
