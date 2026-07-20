import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantPortalConfigSource {

  read(tenant: string): { entryPoint?: unknown } | null {
    void tenant;
    const entryPoint = environment.issuanceEntryPoint;
    if (typeof entryPoint !== 'string' || !entryPoint.trim()) {
      return null;
    }
    return { entryPoint };
  }

  currentTenant(): string | null {
    if (typeof window !== 'undefined') {
      const segment = window.location.hostname.split('.')[0];
      return segment || null;
    }
    return null;
  }
}
