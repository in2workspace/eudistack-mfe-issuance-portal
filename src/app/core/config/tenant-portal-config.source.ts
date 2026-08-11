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

  read(tenant: string): { entryPoint?: unknown; credentialOfferUrl?: unknown; credentialOfferLinkBase?: unknown } | null {
    void tenant;
    const entryPoint = environment.issuanceEntryPoint;
    if (typeof entryPoint !== 'string' || !entryPoint.trim()) {
      return null;
    }
    // EUD-163: campos aditivos — entryPoint y su comportamiento fail-closed
    // (FR-06, EUD-165) quedan intactos; se leen tal cual del runtime env,
    // sin validar aquí (la validación/allow-list vive en
    // resolveCredentialOfferConfig, AD-2).
    return {
      entryPoint,
      credentialOfferUrl: environment.credentialOfferUrl,
      credentialOfferLinkBase: environment.credentialOfferLinkBase,
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
