---
name: feedback-timer-wiring-coverage
description: In this repo, pure "regla" domain functions (e.g. isCredentialOfferExpired) can end up dead/unused while the service reimplements the check inline inside a setTimeout — coverage report is the fastest way to catch it.
metadata:
  type: feedback
---

When reviewing an Angular feature in `eudistack-mfe-issuance-portal` that has a
"pure domain rule + service wires the effect" split (per `hexagonal-architecture`
skill), do not trust that a `*.spec.ts` for the pure function counts as evidence
for the AC/NFR describing the *runtime* behavior (e.g. "the offer expires after
N minutes and the QR is retired"). Always grep whether the pure function is
actually called from the service (e.g. `grep -rn isCredentialOfferExpired src/app`)
before accepting a rule-level test as sufficient AC evidence.

**Why:** Found in EUD-163 code review (2026-08-12): `isCredentialOfferExpired`
(`credential-offer-expiry.ts`) was fully unit-tested but never called anywhere —
the service (`credential-offer.service.ts`) reimplemented the same TTL math
inline inside a `setTimeout` callback that had 0% test coverage (confirmed via
`npx jest --coverage --collectCoverageFrom=...`). The technical-design's own
test matrix pointed the NFR/ES evidence at the pure-function spec, masking the
gap. This was a BLOCKING finding.

**How to apply:** For any Story with a TTL/expiry/timer/race-condition NFR,
always run `npx jest --coverage --collectCoverageFrom='<feature-glob>'` and
inspect "Uncovered Line #s" for the service/orchestration file, not just the
aggregate repo coverage number the developer reports. Cross-check every domain
function referenced in the AC/NFR trace table is actually imported+called in
the production file that AC claims to cover.
