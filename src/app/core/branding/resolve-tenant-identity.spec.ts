import { resolveTenantIdentity } from './resolve-tenant-identity';

describe('resolveTenantIdentity', () => {
  it('resolves the tenant from the subdomain', () => {
    expect(resolveTenantIdentity({ hostname: 'cgcom.eudistack.net' }, {})).toBe('cgcom');
  });

  it('the window.env tenant override takes priority over the subdomain (dev)', () => {
    expect(
      resolveTenantIdentity({ hostname: 'cgcom.eudistack.net' }, { tenant: 'kpmg' }),
    ).toBe('kpmg');
  });

  it('returns null when the hostname has no subdomain and there is no override (ES-03)', () => {
    expect(resolveTenantIdentity({ hostname: 'localhost' }, {})).toBeNull();
  });

  it('does not guess a tenant when the override is an empty/blank string', () => {
    expect(resolveTenantIdentity({ hostname: 'localhost' }, { tenant: '   ' })).toBeNull();
  });

  it('is a pure function: consecutive calls with different inputs never leak state', () => {
    const first = resolveTenantIdentity({ hostname: 'cgcom.eudistack.net' }, {});
    const second = resolveTenantIdentity({ hostname: 'kpmg.eudistack.net' }, {});
    const third = resolveTenantIdentity({ hostname: 'localhost' }, {});

    expect(first).toBe('cgcom');
    expect(second).toBe('kpmg');
    expect(third).toBeNull();
  });
});
