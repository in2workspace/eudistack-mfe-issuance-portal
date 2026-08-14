import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantPortalConfigSource {

  /**
   * Reads the portal config for a tenant from runtime env (`env.js`).
   *
   * Phase 1 model (AD-1): one deploy == one tenant, so each tenant ships its own
   * `env.js` with its own `issuance_entry_point`; a single build serves N tenants
   * (NFR-T-01). The `tenant` argument is therefore not yet used to key a lookup —
   * it is the seam for EUD-166, which will swap this provider for a shared-assets
   * source keyed by tenant *without changing this signature*.
   * `resolveTenantPortalConfig()` already threads `tenant` through to here.
   */

  read(tenant: string): {
    entryPoint?: unknown;
    credentialOfferUrl?: unknown;
    credentialOfferLinkBase?: unknown;
    identificationUrl?: unknown;
    identificationCorrelationMode?: unknown;
    identificationCorrelationParam?: unknown;
  } | null {
    void tenant;
    // EUD-163/EUD-164: entryPoint, credentialOffer* e identification* son
    // campos independientes del mismo runtime env — un tenant sin
    // issuance_entry_point configurado (safe no-op, FR-06/EUD-165) no debe
    // bloquear la disponibilidad de la oferta de credencial ni el destino
    // de identificación, ni viceversa. Cada consumidor valida el campo que
    // le interesa (resolveTenantPortalConfig -> isIssuanceEntryPoint;
    // resolveCredentialOfferConfig -> validateCredentialOfferEndpoint/Base;
    // resolveTenantIdentificationConfig -> validateIdentificationUrl +
    // allow-list de modo, AD-3/AD-5) — este método no decide fail-closed
    // por ninguno de los tres; el tipo de retorno conserva `| null` por
    // compatibilidad con la interfaz, pero esta implementación real
    // siempre devuelve el objeto.
    return {
      entryPoint: environment.issuanceEntryPoint,
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
