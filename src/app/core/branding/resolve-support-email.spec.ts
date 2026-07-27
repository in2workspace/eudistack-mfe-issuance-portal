import { environment } from '../../../environments/environment';
import { resolveSupportEmail } from './resolve-support-email';

describe('resolveSupportEmail', () => {
  const originalTenant = environment.tenant;

  afterEach(() => {
    environment.tenant = originalTenant;
  });

  it('derives the support address from the resolved tenant', () => {
    environment.tenant = 'calidalia';

    expect(resolveSupportEmail()).toBe('soporte@calidalia-identidad.es');
  });

  it('falls back to the neutral EUDIStack domain when the tenant is not resolvable (ES-03)', () => {
    environment.tenant = '';
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'localhost' },
      writable: true,
    });

    expect(resolveSupportEmail()).toBe('soporte@eudistack-identidad.es');
  });
});
