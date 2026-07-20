import {
  ISSUANCE_ENTRY_POINTS,
  isIssuanceEntryPoint,
} from './issuance-entry-point';

describe('isIssuanceEntryPoint (ES-01)', () => {
  it('acepta los valores del allow-list', () => {
    expect(isIssuanceEntryPoint('WITH_VALIDATION')).toBe(true);
    expect(isIssuanceEntryPoint('DIRECT')).toBe(true);
  });

  it('cubre exactamente el allow-list', () => {
    expect([...ISSUANCE_ENTRY_POINTS]).toEqual(['WITH_VALIDATION', 'DIRECT']);
  });

  it('rechaza valores fuera del allow-list sin colapsar a un valor por defecto', () => {
    for (const value of ['', 'direct', 'with_validation', 'OTHER', 'DEFAULT']) {
      expect(isIssuanceEntryPoint(value)).toBe(false);
    }
  });

  it('rechaza valores malformados (no string)', () => {
    for (const value of [null, undefined, 0, {}, [], true]) {
      expect(isIssuanceEntryPoint(value)).toBe(false);
    }
  });
});
