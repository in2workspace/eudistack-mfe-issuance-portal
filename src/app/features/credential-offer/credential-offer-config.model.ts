/**
 * Configuración por tenant para obtener e invocar la oferta de credencial.
 * `endpoint`: destino same-origin del proceso de emisión. `walletInvocationBase`:
 * base same-origin o el esquema estándar `openid-credential-offer://` (AD-2).
 */
export interface CredentialOfferConfig {
  endpoint: string;
  walletInvocationBase: string;
}

export type CredentialOfferConfigFailureReason = 'config_absent' | 'endpoint_invalid';

export type CredentialOfferConfigResult =
  | { ok: true; config: CredentialOfferConfig }
  | { ok: false; reason: CredentialOfferConfigFailureReason };
