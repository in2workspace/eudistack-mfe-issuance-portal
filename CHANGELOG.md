# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **EUD-163** — Presentar la oferta de credencial al titular: QR + deeplink (US-02).
  - `CredentialOfferComponent` (ruta `offer`, protegida por `authGuard`): cuatro estados — `loading` (AC-04), `ready` con QR + enlace visibles a la vez (AC-01, AC-02), `ready-without-qr` cuando la URL supera 1200 caracteres codificados (ES-06), y `unavailable` con aviso genérico + Reintentar, sin causa técnica ni identificador interno (AC-05). QR generado con `qrcode` a partir de un único cálculo (`resolveWalletInvocationUrl`) que también alimenta el enlace. Accesible: alternativa textual del QR, nombre accesible del enlace, cambios de estado anunciados (AC-08, WCAG 2.1 AA).
  - `CredentialOfferService`: orquesta la petición con guard single-flight y memoización por clave de proceso — una oferta ya presentada nunca se solicita ni se sustituye dos veces (AC-07); `retry()` disponible tras un fallo o expiración; temporizador de caducidad de 10 min sin renovación deslizante (NFR-S-163-01).
  - `CredentialOfferSource`: `HttpClient.post` con timeout de 15 s (NFR-P-163-01) y validación de la referencia en la frontera; nunca propaga `status`/`error`/`url` de la respuesta ni los registra (NFR-S-163-03).
  - Config runtime nueva y **obligatoria por despliegue** (fail-closed, sin default embebido): `credential_offer_url` y `credential_offer_link_base` en `env.js`/`env.template.js` (`environment.ts`/`.prod.ts` en dev/prod) — sin poblarlas, la pantalla siempre presenta "oferta no disponible" (ES-02).
  - `CredentialOfferUrlBoxComponent`: literales externalizados a i18n, color CGCOM hardcodeado `#1A5276` sustituido por el token de branding `brand-accent` (EUD-166); comportamiento de copia sin cambios (EC-05).
  - `CannotContinueReason`: extensión aditiva con `OFFER_UNAVAILABLE` y `OFFER_TIMEOUT`.
- **EUD-162** — Pantalla informativa de arranque de emisión con CTA self-service (US-01).
  - `IssuanceInfoComponent`: estado informativo (info + CTA) y estado "no se puede continuar" (aviso genérico + Reintentar), sin fugar detalle interno (AC-01, AC-04, AC-05, AC-06).
  - `IssuanceStartSession` + `IssuanceStartSessionStore`: sesión de arranque del titular persistida en `sessionStorage`, fail-closed si la escritura falla (AC-02, ES-03).
  - `IssuanceStartService`: orquesta el arranque con guard de double-submit (EC-02) y navegación externa (`ExternalNavigator`), seam para EUD-164.
  - `resolveIssuanceStartUrl()`: destino del CTA configurable vía `environment.issuanceStartUrl` (runtime `env.js`), con fallback seguro `'#'` (ES-02).
  - `CannotContinueReason`: enum cerrado con colapso a `Unknown` para causas desconocidas (ES-01), seam para EUD-163/EUD-164.
  - Accesibilidad WCAG 2.1 AA: CTA operable por teclado, `aria-label`, único `h1`, objetivo táctil ≥44×44px (AC-03, EC-01).
  - i18n: `@ngx-translate` con `MissingTranslationHandler` determinista (nunca `undefined`/`null`/vacío) y catálogo `es.json` (AC-04, EC-03).
  - Re-apuntada la ruta de entrada (`''` → `portal`) a `IssuanceInfoComponent`; rutas demo CGCOM existentes quedan intactas hasta EUD-163/EUD-164.
- **Tenant-configured issuance entry point (EUD-165)** — after identification the
  portal selects and starts the entry point (`WITH_VALIDATION` / `DIRECT`)
  configured per tenant via runtime `env.js`, fail-closed when the configuration
  is missing or invalid, with a safe no-op when the downstream target is not yet
  set.
- **EUD-166 US-05 — Branding and language resolved per tenant at runtime**: the portal now resolves tenant identity from the subdomain (`resolveTenantIdentity`, with a `window.env.tenant` override for dev/local), loads the tenant's branding/language descriptor from the shared assets repository (`TenantBrandingSource`, `{assetsBaseUrl}/{tenant}/theme.json`, SAD §8.8), and applies it via a fail-safe resolver (`resolveTenantBranding`) before the component tree bootstraps (`APP_INITIALIZER`, AC-06 — no flash). Logo, theme tokens (CSS custom properties consumed by Tailwind), favicon, app name and language are exposed through `BrandingService`/`TenantLanguageService`. A tenant without branding configured, with a partial/malformed descriptor, or hit by a network failure or timeout always falls back to the neutral `DEFAULT_EUDISTACK_BRANDING` — never to another tenant's branding (AC-01 to AC-06, EC-01 to EC-05, ES-01 to ES-05).
- **EUD-166 — `@ngx-translate` wiring kept on the `provideTranslateService` API**: EUD-162 and EUD-166 independently wired `@ngx-translate` (`TranslateModule.forRoot` vs. `provideTranslateService`); the rebase onto `main` converges on EUD-166's `provideTranslateService` setup (`defaultLanguage: 'es'`, `useDefaultLang: true`, deterministic `AppMissingTranslationHandler`) since it is a strict superset — it additionally drives tenant language resolution (`TenantLanguageService`) from the branding pipeline above.

### Removed

- **EUD-163 (AD-5) — Retirada de material demo CGCOM superado por la feature real:** `IssuerService`, `CredentialQrComponent` y la ruta `qr` se eliminan (sin consumidores tras la feature nueva). `IssuanceStateService` pierde las señales `credentialOfferUrl`/`bootstrapLoading`/`bootstrapError` y sus setters (`authenticatedUser` intacto). `UserDataComponent.onContinue()` deja de invocar `IssuerService.bootstrap()` y navega directamente a `/offer`, donde la obtención de la oferta pasa a vivir.

### Changed

- **EUD-162 (post-cierre) — CTA "Empezar" y bootstrap de emisión pasan a rutas same-origin (multi-tenant fix):** bug detectado en dev — con el tenant resuelto en "dome" (`https://dome.127.0.0.1.nip.io:4443/identify/portal`), el CTA redirigía a `https://cgcom.127.0.0.1.nip.io:4443/cert/`, porque `resolveIssuanceStartUrl()`/`landing.component`/`IssuerService` leían hosts absolutos hardcodeados a `cgcom.*` (`environment.certIdentifierUrl`, `environment.bootstrapApiUrl`). nginx enruta `/cert/` y `/identify/api/bootstrap` de forma idéntica bajo cualquier subdominio de tenant (`location ^~ /cert/`, `location ~ ^/identify/(api/|health)` → mismo `cert-server`), así que ambos pasan a rutas relativas same-origin (`/cert/`, `/identify/api/bootstrap`) — sin reconstruir ni leer ningún host, preservando el tenant actual automáticamente. `environment.certIdentifierUrl` / `environment.bootstrapApiUrl` / `environment.issuanceStartUrl` (y sus `cert_identifier_url` / `bootstrap_api_url` / `issuance_start_url` en `env.js`/`env.template.js`) quedan sin consumidores y se retiran. `IssuanceStateService.certIdentifierUrl` eliminado (único consumo). **Fuera de alcance de este fix:** `eudistack-cgcom-cert-identifier-service` (backend `cert-server.mjs`) sigue enviando `X-Tenant: cgcom` hardcodeado al Issuer real y su allow-list CORS solo acepta origin `cgcom.*` — sin ese fix en paralelo (rama `fix/` propia en ese repo), el flujo de identificación seguirá bootstrapeando contra el tenant CGCOM independientemente del subdominio.

- **`doctor-data` renombrado a `user-data` + contenido por tenant:** el nombre de ruta/componente (`portal/doctor-data`, `DoctorDataComponent`) era CGCOM-específico pese a que la pantalla ya no lo es tras este cambio. Renombrado a `portal/user-data`/`UserDataComponent` (`git mv`, actualizadas las 2 navegaciones que apuntaban a la ruta antigua en `app.component.ts` y `credential-qr.component.ts`). El copy de la pantalla (título, etiquetas de campo, aviso informativo) ahora depende del tenant resuelto: CGCOM ve "Datos del Médico" (Número de colegiado, Colegio Provincial, Especialidad); el resto ve "Datos del Empleado" (Número de empleado, Empresa, Puesto). Logo del header pasa a `BrandingService.logoUrl()` (antes `cgcom-header-logo.svg` fijo) y los colores hardcodeados (`#1A5276`/`#E67E22`) a los tokens `brand-primary`/`brand-secondary` ya usados en el resto del repo (EUD-166).

- **EUD-162 (post-cierre):** footer de `IssuanceInfoComponent` alineado con el de `/identify/demo` (columnas "Enlaces Útiles" y "Soporte" + copyright con "Desarrollado por Altia"), sin el logo CGCOM. Añadido botón "Canal de Soporte" en el hero y sección "¿Necesitas Ayuda?" (Reportar Incidencia -> `/portal/incidents`, Contactar por Email -> `mailto:`), reutilizando el email/teléfono ya usados en `incidents.component`. Textos vía i18n (`es.json`). Tests de `issuance-info.component.spec.ts` ajustados para verificar el CTA de arranque por `aria-label` en vez de contar el total de botones de la pantalla (ver nota de alcance en AC-01, `docs/EUD-23-portal-emision/EUD-162/acceptance-criteria.md`).
- Migrado el test runner de Karma/Jasmine (default Angular CLI) a **Jest + jest-preset-angular + jest-axe**, alineando el repo con el resto de la flota Angular EUDIStack.
- **EUD-162 (post-cierre, AD-5):** rediseño del estado informativo de `IssuanceInfoComponent` adoptando el lenguaje visual del Demo CGCOM (`features/portal/landing`) en versión neutra: hero con degradado + icono, secciones "¿Qué es la Cartera de Identidad Digital?" y "Cómo funciona", y footer con enlaces legales (texto plano, sin destino real todavía) + copyright. Añadida la ruta `demo` para mantener accesible el `LandingComponent` preexistente, huérfano tras re-apuntar `portal`. `DeterministicMissingTranslationHandler` extraído a fichero propio y cubierto por test (EC-03).
- **EUD-162 (merge con main / EUD-165):** `IssuanceStartSessionStore` y `CannotContinueReason` se alinean con la versión ya integrada en `main` (consumida por `IssuanceEntryPointService`, EUD-165): `create()` recibe ahora el objeto `IssuanceStartSession` completo (la generación del id se movió a `IssuanceStartService`) y devuelve `boolean` en vez de la sesión o `null`, preservando el fail-closed de ES-03 sin afectar a `read()` (el único método que consume EUD-165).
- **EUD-166 — Test infrastructure migrated from Karma/Jasmine to Jest** (`jest-preset-angular`, same pattern as `eudistack-mfe-login`): `angular.json`'s `test` target now uses `@angular-devkit/build-angular:jest`, and `npm test` runs `jest` directly. Converges with EUD-162's independent migration to the same tooling.

[Unreleased]: https://github.com/in2workspace/eudistack-mfe-issuance-portal/compare/main...HEAD
