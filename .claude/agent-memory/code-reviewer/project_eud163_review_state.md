---
name: project-eud163-review-state
description: EUD-163 (credential-offer QR+deeplink, eudistack-mfe-issuance-portal) code review outcome as of 2026-08-12 — CHANGES REQUESTED, 2 blocking findings, awaiting fixes before re-review.
metadata:
  type: project
---

Story EUD-163 ("Presentar la oferta de credencial al titular — QR + deeplink",
Epic EUD-23) reviewed on branch `feature/EUD-163-oferta-credencial-qr-deeplink`
(12 commits over `main`) on 2026-08-12. Verdict: **CHANGES REQUESTED**.

Blocking findings:
1. `credential-offer.service.ts` `armExpiryTimer()` (ES-03/NFR-S-163-01, 10-min
   presentation window) and the last-request-wins guard (§3.4.1 W-2) have 0%
   test coverage on the actual production code path (confirmed via
   `npx jest --coverage --collectCoverageFrom=...`). The pure domain function
   `isCredentialOfferExpired` (`credential-offer-expiry.ts`) that was supposed
   to implement this rule is dead code — never called from the service.
2. No Story-specific version bump commit exists — `git diff main..HEAD --
   package.json` is empty; `0.1.3` was inherited from a `main` merge
   belonging to an unrelated, already-released Story. `tasks.md` C5 falsely
   marked `completed`.

Non-blocking (3 WARNING, would independently trigger CHANGES REQUESTED under
the ">2 WARNING" rule even without the blocking findings): missing
`spec-deltas.md` for 3 undocumented implementation deltas (route path `offer`
vs `portal/offer`, endpoint path rename, AbortController vs RxJS timeout());
`validate-credential-offer-reference.ts` over-accepts `openid-credential-offer:`
protocol for the offer reference itself (should be `https:` only per OID4VCI
1.0 §4.1); a test in `credential-offer.service.spec.ts` mislabeled "EC-03".

Everything else in the feature was solid: correct hexagonal layering, correct
OID4VCI 1.0 `credential_offer_uri` wire format, NFR-S-163-02/03 correctly
enforced in the code paths that ARE tested, AD-5 demo-material retirement
clean (no dangling refs to `IssuerService`/`CredentialQrComponent`/`portal/qr`).

Next step: `fullstack-developer` applies fixes (add fake-timer tests for the
expiry wiring, add the version-bump commit, optionally add `spec-deltas.md`),
then re-request `/code-review`.
