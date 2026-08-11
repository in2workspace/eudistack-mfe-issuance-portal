/**
 * Oferta de credencial obtenida del proceso de emisión (EUD-3/EUD-4).
 * `reference` es el valor devuelto por el emisor, sin alterar (AC-03).
 */
export interface CredentialOffer {
  reference: string;
  obtainedAt: number;
}

export type CredentialOfferFailureReason =
  | 'config_absent'
  | 'endpoint_invalid'
  | 'malformed'
  | 'issuance_error'
  | 'timeout'
  | 'expired';

export type CredentialOfferResult =
  | { ok: true; offer: CredentialOffer }
  | { ok: false; reason: CredentialOfferFailureReason };
