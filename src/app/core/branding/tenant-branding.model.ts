/**
 * Branding e idioma resueltos para un tenant. Siempre completo y válido:
 * `resolveTenantBranding()` (AD-1/AD-2) garantiza que todo consumidor recibe
 * una instancia utilizable, nunca campos parciales o crudos (EC-01/EC-02/ES-01).
 */
export interface TenantBranding {
  /** CSS custom properties del tema (`--brand-*`), consumidas por Tailwind (AD-4). */
  tokens: Record<string, string>;
  logoUrl: string;
  faviconUrl: string;
  /** Idioma aplicado si el configurado por el tenant no es válido/soportado. */
  defaultLanguage: string;
  /** Allow-list de idiomas que `TenantLanguageService` acepta para este tenant. */
  supportedLanguages: string[];
}

/**
 * Branding neutro de EUDIStack. Constante estática (nunca mutada ni derivada
 * de un tenant previo) — es la base del aislamiento entre tenants (AD-3, R-2):
 * ante ausencia/error, todos los titulares ven exactamente este mismo default.
 */
export const DEFAULT_EUDISTACK_BRANDING: Readonly<TenantBranding> = Object.freeze({
  tokens: Object.freeze({
    '--brand-primary': '#0F2B5B',
    '--brand-primary-contrast': '#ffffff',
    '--brand-secondary': '#00BFA6',
    '--brand-secondary-contrast': '#ffffff',
    // Color de acento seguro sobre fondo blanco (icono/texto de botón) —
    // ver deriveAccentTokens() en resolve-tenant-branding.ts. El default
    // navy nunca es "casi blanco", así que coincide con --brand-primary.
    '--brand-accent': '#0F2B5B',
    '--brand-accent-contrast': '#ffffff',
  }),
  // Todos los headers de este repo tienen fondo blanco: se usa la variante
  // oscura del logo (contraste sobre claro), nunca la clara `logo.svg`
  // (pensada para fondos de color/oscuros — sería invisible aquí).
  logoUrl: '/assets/tenants/eudistack/logo-dark.svg',
  faviconUrl: '/assets/tenants/eudistack/favicon.svg',
  defaultLanguage: 'es',
  supportedLanguages: Object.freeze(['es', 'en']) as string[],
});
