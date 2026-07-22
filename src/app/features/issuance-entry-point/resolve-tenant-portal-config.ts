import type { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { isIssuanceEntryPoint } from './issuance-entry-point';
import type { TenantPortalConfigResult } from './tenant-portal-config.model';

export function resolveTenantPortalConfig(
  tenant: string,
  source: TenantPortalConfigSource,
): TenantPortalConfigResult {
  const normalized = tenant?.trim();
  if (!normalized) {
    return { ok: false, reason: 'config_absent' };
  }

  const raw = source.read(normalized);
  if (!raw) {
    return { ok: false, reason: 'config_absent' };
  }

  if (!isIssuanceEntryPoint(raw.entryPoint)) {
    return { ok: false, reason: 'entry_point_invalid' };
  }

  return {
    ok: true,
    config: { tenant: normalized, entryPoint: raw.entryPoint },
  };
}
