# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **EUD-162** — Pantalla informativa de arranque de emisión con CTA self-service (US-01).
  - `IssuanceInfoComponent`: estado informativo (info + CTA) y estado "no se puede continuar" (aviso genérico + Reintentar), sin fugar detalle interno (AC-01, AC-04, AC-05, AC-06).
  - `IssuanceStartSession` + `IssuanceStartSessionStore`: sesión de arranque del titular persistida en `sessionStorage`, fail-closed si la escritura falla (AC-02, ES-03).
  - `IssuanceStartService`: orquesta el arranque con guard de double-submit (EC-02) y navegación externa (`ExternalNavigator`), seam para EUD-164.
  - `resolveIssuanceStartUrl()`: destino del CTA configurable vía `environment.issuanceStartUrl` (runtime `env.js`), con fallback seguro `'#'` (ES-02).
  - `CannotContinueReason`: enum cerrado con colapso a `Unknown` para causas desconocidas (ES-01), seam para EUD-163/EUD-164.
  - Accesibilidad WCAG 2.1 AA: CTA operable por teclado, `aria-label`, único `h1`, objetivo táctil ≥44×44px (AC-03, EC-01).
  - i18n: `@ngx-translate` con `MissingTranslationHandler` determinista (nunca `undefined`/`null`/vacío) y catálogo `es.json` (AC-04, EC-03).
  - Re-apuntada la ruta de entrada (`''` → `portal`) a `IssuanceInfoComponent`; rutas demo CGCOM existentes quedan intactas hasta EUD-163/EUD-164.

### Changed

- **EUD-162 (post-cierre):** footer de `IssuanceInfoComponent` alineado con el de `/identify/demo` (columnas "Enlaces Útiles" y "Soporte" + copyright con "Desarrollado por Altia"), sin el logo CGCOM. Añadido botón "Canal de Soporte" en el hero y sección "¿Necesitas Ayuda?" (Reportar Incidencia -> `/portal/incidents`, Contactar por Email -> `mailto:`), reutilizando el email/teléfono ya usados en `incidents.component`. Textos vía i18n (`es.json`). Tests de `issuance-info.component.spec.ts` ajustados para verificar el CTA de arranque por `aria-label` en vez de contar el total de botones de la pantalla (ver nota de alcance en AC-01, `docs/EUD-23-portal-emision/EUD-162/acceptance-criteria.md`).
- Migrado el test runner de Karma/Jasmine (default Angular CLI) a **Jest + jest-preset-angular + jest-axe**, alineando el repo con el resto de la flota Angular EUDIStack.
- **EUD-162 (post-cierre, AD-5):** rediseño del estado informativo de `IssuanceInfoComponent` adoptando el lenguaje visual del Demo CGCOM (`features/portal/landing`) en versión neutra: hero con degradado + icono, secciones "¿Qué es la Cartera de Identidad Digital?" y "Cómo funciona", y footer con enlaces legales (texto plano, sin destino real todavía) + copyright. Añadida la ruta `demo` para mantener accesible el `LandingComponent` preexistente, huérfano tras re-apuntar `portal`. `DeterministicMissingTranslationHandler` extraído a fichero propio y cubierto por test (EC-03).

[Unreleased]: https://github.com/in2workspace/eudistack-cgcom-mfe-issuance-portal/compare/main...HEAD
