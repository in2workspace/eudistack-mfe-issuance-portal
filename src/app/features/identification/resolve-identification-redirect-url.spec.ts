import { resolveIdentificationRedirectUrl } from './resolve-identification-redirect-url';
import { TenantIdentificationConfig } from './tenant-identification-config.model';

/**
 * Riesgo dedicado R-5: el repo ya sufrió una regresión de host fijo con
 * `certIdentifierUrl`. Estos tests aíslan ese riesgo específicamente.
 */
describe('resolveIdentificationRedirectUrl', () => {
  it('same_context mode: returns the relative destination untouched, no correlation param (EC-03, EC-01)', () => {
    const config: TenantIdentificationConfig = {
      url: '/cert/?method=certificate',
      correlationMode: 'same_context',
    };

    expect(resolveIdentificationRedirectUrl(config, 'token-abc')).toBe('/cert/?method=certificate');
  });

  it('echo mode + relative destination: preserves the same-origin path and existing query params, adds only the correlation param (EC-03, R-5)', () => {
    const config: TenantIdentificationConfig = {
      url: '/cert/?method=certificate',
      correlationMode: 'echo',
      correlationParam: 'state',
    };

    const result = resolveIdentificationRedirectUrl(config, 'token-abc');

    expect(result.startsWith('/cert/')).toBe(true);
    expect(result).not.toContain('eudistack-same-origin.invalid');
    const params = new URLSearchParams(result.split('?')[1]);
    expect(params.get('method')).toBe('certificate');
    expect(params.get('state')).toBe('token-abc');
  });

  it('echo mode + absolute https destination: adds the correlation param without fixing a different host', () => {
    const config: TenantIdentificationConfig = {
      url: 'https://idp.example.org/auth?client=cgcom',
      correlationMode: 'echo',
      correlationParam: 'state',
    };

    const result = resolveIdentificationRedirectUrl(config, 'token-abc');
    const parsed = new URL(result);

    expect(parsed.origin).toBe('https://idp.example.org');
    expect(parsed.searchParams.get('client')).toBe('cgcom');
    expect(parsed.searchParams.get('state')).toBe('token-abc');
  });

  it('echo mode without correlationParam configured: returns the destination untouched (defensive — resolveTenantIdentificationConfig should already have rejected this)', () => {
    const config: TenantIdentificationConfig = { url: '/cert/?method=certificate', correlationMode: 'echo' };

    expect(resolveIdentificationRedirectUrl(config, 'token-abc')).toBe('/cert/?method=certificate');
  });
});
