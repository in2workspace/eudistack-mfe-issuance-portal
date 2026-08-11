import { CredentialOfferConfig, CredentialOfferConfigResult } from './credential-offer-config.model';
import { validateCredentialOfferEndpoint, validateWalletInvocationBase } from './validate-credential-offer-endpoint';

/**
 * Puerto mínimo hacia la fuente de config por tenant — desacoplado de
 * `TenantPortalConfigSource` a propósito (capa de dominio sin dependencias
 * de framework). El adapter real (EUD-165, extendido en T10) satisface esta
 * forma con su método `read(tenant)`.
 */
export interface CredentialOfferConfigSource {
  read(tenant: string): { credentialOfferUrl?: unknown; credentialOfferLinkBase?: unknown } | null;
}

/**
 * Resuelve la config de la oferta de credencial para un tenant. Fail-closed:
 * sin config, o con una forma no admitida por la allow-list, devuelve un
 * resultado tipado sin llamar a `validate*` con un default embebido en
 * código (AD-2, mismo criterio que EUD-164 AD-5 / EUD-165 AD-2).
 */
export function resolveCredentialOfferConfig(
  tenant: string,
  source: CredentialOfferConfigSource,
): CredentialOfferConfigResult {
  const raw = source.read(tenant);
  if (!raw) {
    return { ok: false, reason: 'config_absent' };
  }

  const { credentialOfferUrl, credentialOfferLinkBase } = raw;
  if (credentialOfferUrl === undefined || credentialOfferLinkBase === undefined) {
    return { ok: false, reason: 'config_absent' };
  }
  if (
    !validateCredentialOfferEndpoint(credentialOfferUrl) ||
    !validateWalletInvocationBase(credentialOfferLinkBase)
  ) {
    return { ok: false, reason: 'endpoint_invalid' };
  }

  const config: CredentialOfferConfig = {
    endpoint: credentialOfferUrl,
    walletInvocationBase: credentialOfferLinkBase,
  };
  return { ok: true, config };
}
