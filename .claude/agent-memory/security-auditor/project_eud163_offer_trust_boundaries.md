---
name: eud163-offer-trust-boundaries
description: EUD-163 security audit (2026-08-12) — the issuance-portal trusts an unauthenticated demo bootstrap endpoint and an unsigned ?u= identity handoff; both are cross-repo escalations, not frontend bugs.
metadata:
  type: project
---

Audit of `feature/EUD-163-oferta-credencial-qr-deeplink` (2026-08-12) found that the two most severe issues on the credential-offer flow are **inherited demo material outside this repo**, not defects of the Story:

- `POST /issuance-portal/api/bootstrap` (`eudistack-enterprise-cert-identifier-service/server/cert-server.mjs`) has **no caller authentication** and forwards body-supplied identity attributes to the Issuer with a privileged `X-Bootstrap-Token`.
- `AppComponent` accepts the authenticated user from `?identified=1&u=<base64 JSON>` with no signature, so `authGuard` is not an authorization control.

**Why:** both predate EUD-163 (the Story only changed *who* calls the endpoint), and their definitive contract belongs to EUD-3 / EUD-4 / EUDISTACK-622 — see `technical-design.md` R-4. Reporting them as EUD-163 regressions would be wrong; they must be escalated as platform findings.

**How to apply:** in any future audit of this repo, re-check whether those two are still open before re-litigating them, and keep them separated from Story-scoped findings in the verdict. The Story-scoped blocker found was the same-origin allow-list in `validate-credential-offer-endpoint.ts` (prefix-string check, bypassable by ASCII tab/CR/LF, which the WHATWG URL parser strips); the robust form is `new URL(value, origin).origin === origin`. Related: [[eud163-runtime-env-trust]] if a runtime-env hardening decision is ever recorded.
