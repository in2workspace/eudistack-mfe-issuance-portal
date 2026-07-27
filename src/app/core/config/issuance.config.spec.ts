import { resolveIssuanceStartUrl } from './issuance.config';

describe('resolveIssuanceStartUrl', () => {
  it('returns the same-origin cert-identifier path, tenant-agnostic (AD-2)', () => {
    expect(resolveIssuanceStartUrl()).toBe('/cert/');
  });
});
