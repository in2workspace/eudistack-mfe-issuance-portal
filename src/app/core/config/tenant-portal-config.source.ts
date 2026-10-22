import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantPortalConfigSource {

  /**
   * Reads the portal config for a tenant from runtime env (`env.js`).
   *
   * Phase 1 model (AD-1): one deploy == one tenant, so each tenant ships its own
   * `env.js`; a single build serves N tenants (NFR-T-01). The `tenant` argument
   * is therefore not yet used to key a lookup. Only the offer (EUD-163) and the
   * certificate redirect (EUD-164) read it; both go away with the screens that
   * call the issuance portal service (EUD-285, EUD-286).
   */

  read(tenant: string): {
    credentialOfferUrl?: unknown;
    credentialOfferLinkBase?: unknown;
    identificationUrl?: unknown;
    identificationCorrelationMode?: unknown;
    identificationCorrelationParam?: unknown;
  } | null {
    void tenant;
    // EUD-163/EUD-164: credentialOffer* e identification* son campos
    // independientes del mismo runtime env. Cada consumidor valida el campo
    // que le interesa (resolveCredentialOfferConfig ->
    // validateCredentialOfferEndpoint/Base; resolveTenantIdentificationConfig
    // -> validateIdentificationUrl + allow-list de modo, AD-3/AD-5). El tipo
    // de retorno conserva `| null` por compatibilidad con la interfaz, pero
    // esta implementación siempre devuelve el objeto.
    return {
      credentialOfferUrl: environment.credentialOfferUrl,
      credentialOfferLinkBase: environment.credentialOfferLinkBase,
      identificationUrl: environment.identificationUrl,
      identificationCorrelationMode: environment.identificationCorrelationMode,
      identificationCorrelationParam: environment.identificationCorrelationParam,
    };
  }

  currentTenant(): string | null {
    if (typeof window !== 'undefined') {
      const segment = window.location.hostname.split('.')[0];
      return segment || null;
    }
    return null;
  }
}
