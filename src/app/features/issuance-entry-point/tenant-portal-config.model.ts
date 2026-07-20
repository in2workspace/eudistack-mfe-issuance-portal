import type { IssuanceEntryPoint } from './issuance-entry-point';

export interface TenantPortalConfig {
  tenant: string;
  entryPoint: IssuanceEntryPoint;
}

export type TenantPortalConfigFailureReason =
  | 'config_absent'
  | 'entry_point_invalid';

export type TenantPortalConfigResult =
  | { ok: true; config: TenantPortalConfig }
  | { ok: false; reason: TenantPortalConfigFailureReason };
