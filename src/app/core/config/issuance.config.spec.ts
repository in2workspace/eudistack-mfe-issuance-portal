import { environment } from '../../../environments/environment';
import { resolveIssuanceStartUrl } from './issuance.config';

describe('resolveIssuanceStartUrl', () => {
  const originalUrl = environment.issuanceStartUrl;

  afterEach(() => {
    environment.issuanceStartUrl = originalUrl;
  });

  it('returns the configured URL when set (ES-02)', () => {
    environment.issuanceStartUrl = 'https://identify.example.org/start';

    expect(resolveIssuanceStartUrl()).toBe('https://identify.example.org/start');
  });

  it('returns the fallback "#" without throwing when absent', () => {
    environment.issuanceStartUrl = undefined as unknown as string;

    expect(resolveIssuanceStartUrl()).toBe('#');
  });

  it('returns the fallback "#" without throwing when empty/blank', () => {
    environment.issuanceStartUrl = '   ';

    expect(resolveIssuanceStartUrl()).toBe('#');
  });
});
