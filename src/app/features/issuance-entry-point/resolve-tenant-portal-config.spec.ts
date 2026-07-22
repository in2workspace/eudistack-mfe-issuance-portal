import type { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { resolveTenantPortalConfig } from './resolve-tenant-portal-config';

function fakeSource(
  map: Record<string, { entryPoint?: unknown } | null>,
): TenantPortalConfigSource {
  return {
    read: (tenant: string) => map[tenant] ?? null,
    currentTenant: () => null,
  } as TenantPortalConfigSource;
}

describe('resolveTenantPortalConfig', () => {
  it('AC-03: two different tenants each resolve their own entryPoint at runtime, with no code changes', () => {
    const source = fakeSource({
      cgcom: { entryPoint: 'WITH_VALIDATION' },
      acme: { entryPoint: 'DIRECT' },
    });

    expect(resolveTenantPortalConfig('cgcom', source)).toEqual({
      ok: true,
      config: { tenant: 'cgcom', entryPoint: 'WITH_VALIDATION' },
    });
    expect(resolveTenantPortalConfig('acme', source)).toEqual({
      ok: true,
      config: { tenant: 'acme', entryPoint: 'DIRECT' },
    });
  });

  it('AC-03: onboarding a third tenant only requires configuration', () => {
    const source = fakeSource({ nuevo: { entryPoint: 'DIRECT' } });
    expect(resolveTenantPortalConfig('nuevo', source).ok).toBe(true);
  });

  it('ES-02: a missing config returns config_absent with no default entryPoint', () => {
    const source = fakeSource({});
    expect(resolveTenantPortalConfig('cgcom', source)).toEqual({
      ok: false,
      reason: 'config_absent',
    });
  });

  it('ES-02: an empty or blank tenant returns config_absent', () => {
    const source = fakeSource({ cgcom: { entryPoint: 'DIRECT' } });
    expect(resolveTenantPortalConfig('', source).ok).toBe(false);
    expect(resolveTenantPortalConfig('   ', source)).toEqual({
      ok: false,
      reason: 'config_absent',
    });
  });

  it('ES-01: an entryPoint outside the allow-list returns entry_point_invalid without falling back to a valid value', () => {
    const source = fakeSource({ cgcom: { entryPoint: 'BOGUS' } });
    expect(resolveTenantPortalConfig('cgcom', source)).toEqual({
      ok: false,
      reason: 'entry_point_invalid',
    });
  });
});
