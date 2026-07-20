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
  it('AC-03: dos tenants distintos resuelven cada uno su entryPoint en runtime, sin cambios de código', () => {
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

  it('AC-03: dar de alta un tercer tenant solo requiere configuración', () => {
    const source = fakeSource({ nuevo: { entryPoint: 'DIRECT' } });
    expect(resolveTenantPortalConfig('nuevo', source).ok).toBe(true);
  });

  it('ES-02: config ausente devuelve config_absent sin entryPoint por defecto', () => {
    const source = fakeSource({});
    expect(resolveTenantPortalConfig('cgcom', source)).toEqual({
      ok: false,
      reason: 'config_absent',
    });
  });

  it('ES-02: tenant vacío o en blanco devuelve config_absent', () => {
    const source = fakeSource({ cgcom: { entryPoint: 'DIRECT' } });
    expect(resolveTenantPortalConfig('', source).ok).toBe(false);
    expect(resolveTenantPortalConfig('   ', source)).toEqual({
      ok: false,
      reason: 'config_absent',
    });
  });

  it('ES-01: entryPoint fuera del allow-list devuelve entry_point_invalid sin colapsar a un valor válido', () => {
    const source = fakeSource({ cgcom: { entryPoint: 'BOGUS' } });
    expect(resolveTenantPortalConfig('cgcom', source)).toEqual({
      ok: false,
      reason: 'entry_point_invalid',
    });
  });
});
