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
  appName: string;
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
  }),
  logoUrl: 'assets/branding/eudistack-logo.svg',
  faviconUrl: 'assets/branding/eudistack-favicon.svg',
  appName: 'EUDIStack',
  defaultLanguage: 'es',
  supportedLanguages: Object.freeze(['es', 'en']) as string[],
});

/**
 * Forma cruda del descriptor de branding tal como llega del origen de assets
 * (`{assetsBaseUrl}/{tenant}/theme.json`), antes de validar. Todos los campos
 * son `unknown`/opcionales: `resolveTenantBranding()` (task 3) valida y
 * sanitiza cada uno antes de aceptarlo — este tipo nunca se usa para renderizar.
 */
export type TenantBrandingDescriptor = {
  tokens?: unknown;
  logoUrl?: unknown;
  faviconUrl?: unknown;
  appName?: unknown;
  defaultLanguage?: unknown;
  supportedLanguages?: unknown;
};

/**
 * Resultado fail-safe de cargar el descriptor de un tenant. `reason` distingue
 * las 4 categorías de fallo que `TenantBrandingSource` (task 5) puede producir;
 * `resolveTenantBranding()` trata todas ellas igual: cae al default (EC-01,
 * ES-01, ES-02, ES-04, ES-05).
 */
export type TenantBrandingResult =
  | { ok: true; descriptor: TenantBrandingDescriptor }
  | { ok: false; reason: 'absent' | 'invalid' | 'error' | 'timeout' };
