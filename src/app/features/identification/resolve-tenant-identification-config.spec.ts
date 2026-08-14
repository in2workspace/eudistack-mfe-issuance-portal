import { resolveTenantIdentificationConfig, IdentificationConfigSource } from './resolve-tenant-identification-config';

describe('resolveTenantIdentificationConfig', () => {
  function sourceReturning(raw: ReturnType<IdentificationConfigSource['read']>): IdentificationConfigSource {
    return { read: jest.fn().mockReturnValue(raw) };
  }

  it('resolves a valid same_context config without requiring correlationParam (AC-01)', () => {
    const source = sourceReturning({
      identificationUrl: '/cert/?method=certificate',
      identificationCorrelationMode: 'same_context',
    });

    const result = resolveTenantIdentificationConfig('cgcom', source);

    expect(result).toEqual({
      ok: true,
      config: { url: '/cert/?method=certificate', correlationMode: 'same_context', correlationParam: undefined },
    });
  });

  it('resolves a valid echo config with correlationParam', () => {
    const source = sourceReturning({
      identificationUrl: 'https://idp.example.org/auth',
      identificationCorrelationMode: 'echo',
      identificationCorrelationParam: 'state',
    });

    const result = resolveTenantIdentificationConfig('kpmg', source);

    expect(result).toEqual({
      ok: true,
      config: { url: 'https://idp.example.org/auth', correlationMode: 'echo', correlationParam: 'state' },
    });
  });

  it('two tenants with distinct runtime config resolve their own destination without code changes (AC-01, NFR-T-01)', () => {
    const cgcomSource = sourceReturning({
      identificationUrl: '/cert/?method=certificate',
      identificationCorrelationMode: 'same_context',
    });
    const kpmgSource = sourceReturning({
      identificationUrl: 'https://idp.kpmg.example.org/auth',
      identificationCorrelationMode: 'echo',
      identificationCorrelationParam: 'state',
    });

    const cgcomResult = resolveTenantIdentificationConfig('cgcom', cgcomSource);
    const kpmgResult = resolveTenantIdentificationConfig('kpmg', kpmgSource);

    expect(cgcomResult.ok && cgcomResult.config.url).toBe('/cert/?method=certificate');
    expect(kpmgResult.ok && kpmgResult.config.url).toBe('https://idp.kpmg.example.org/auth');
  });

  it('returns config_absent without a default when source.read() returns null (ES-02)', () => {
    const source = sourceReturning(null);

    expect(resolveTenantIdentificationConfig('cgcom', source)).toEqual({ ok: false, reason: 'config_absent' });
  });

  it('returns config_absent when identificationUrl or identificationCorrelationMode are missing (ES-02)', () => {
    const source = sourceReturning({ identificationCorrelationMode: 'same_context' });

    expect(resolveTenantIdentificationConfig('cgcom', source)).toEqual({ ok: false, reason: 'config_absent' });
  });

  it('returns identification_url_invalid for a malformed/disallowed destination, without substituting a default (ES-01)', () => {
    const source = sourceReturning({
      identificationUrl: 'javascript:alert(1)',
      identificationCorrelationMode: 'same_context',
    });

    expect(resolveTenantIdentificationConfig('cgcom', source)).toEqual({
      ok: false,
      reason: 'identification_url_invalid',
    });
  });

  it('returns correlation_mode_invalid for an out-of-allow-list mode (ES-02)', () => {
    const source = sourceReturning({
      identificationUrl: '/cert/?method=certificate',
      identificationCorrelationMode: 'implicit',
    });

    expect(resolveTenantIdentificationConfig('cgcom', source)).toEqual({
      ok: false,
      reason: 'correlation_mode_invalid',
    });
  });

  it('returns correlation_param_absent when mode is echo but correlationParam is missing (ES-02)', () => {
    const source = sourceReturning({
      identificationUrl: '/cert/?method=certificate',
      identificationCorrelationMode: 'echo',
    });

    expect(resolveTenantIdentificationConfig('cgcom', source)).toEqual({
      ok: false,
      reason: 'correlation_param_absent',
    });
  });
});
