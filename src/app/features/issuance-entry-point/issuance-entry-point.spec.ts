import {
  ISSUANCE_ENTRY_POINTS,
  isIssuanceEntryPoint,
} from './issuance-entry-point';

describe('isIssuanceEntryPoint (ES-01)', () => {
  it('accepts the allow-list values', () => {
    expect(isIssuanceEntryPoint('WITH_VALIDATION')).toBe(true);
    expect(isIssuanceEntryPoint('DIRECT')).toBe(true);
  });

  it('covers exactly the allow-list', () => {
    expect([...ISSUANCE_ENTRY_POINTS]).toEqual(['WITH_VALIDATION', 'DIRECT']);
  });

  it('rejects values outside the allow-list without falling back to a default', () => {
    for (const value of ['', 'direct', 'with_validation', 'OTHER', 'DEFAULT']) {
      expect(isIssuanceEntryPoint(value)).toBe(false);
    }
  });

  it('rejects malformed values (non-string)', () => {
    for (const value of [null, undefined, 0, {}, [], true]) {
      expect(isIssuanceEntryPoint(value)).toBe(false);
    }
  });
});
