export const ISSUANCE_ENTRY_POINTS = ['WITH_VALIDATION', 'DIRECT'] as const;

export type IssuanceEntryPoint = (typeof ISSUANCE_ENTRY_POINTS)[number];

export function isIssuanceEntryPoint(value: unknown): value is IssuanceEntryPoint {
  return (
    typeof value === 'string' &&
    (ISSUANCE_ENTRY_POINTS as readonly string[]).includes(value)
  );
}
