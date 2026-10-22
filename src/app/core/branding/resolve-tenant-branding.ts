import { PortalConfig } from '../api/generated/journey';
import { DEFAULT_EUDISTACK_BRANDING, TenantBranding } from './tenant-branding.model';

/**
 * Mapea cada CSS custom property (allow-list, R-6) a su clave en
 * `branding.colors` de `GET /config`. Las claves están pendientes de fijar en
 * el contrato con EUD-276; se usan las mismas del `theme.json` en snake_case.
 */
const TOKEN_FIELD_MAP: Record<string, string> = {
  '--brand-primary': 'primary',
  '--brand-primary-contrast': 'primary_contrast',
  '--brand-secondary': 'secondary',
  '--brand-secondary-contrast': 'secondary_contrast',
};

/** Mismo patrón de validación de color que `ThemeService` (Wallet PWA, SAD §8.8) — defensa en profundidad ante inyección de valores CSS (R-6). */
const CSS_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Luminancia relativa (WCAG) de un color hex de 3/6 dígitos — 0 (negro) a 1 (blanco).
 * Formatos de 4/8 dígitos (con alfa) caen al fallback vía try/catch del llamante.
 */
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Por encima de este umbral, un color se considera "casi blanco" — invisible o ilegible sobre fondo claro. */
const NEAR_WHITE_LUMINANCE = 0.9;

function isNearWhite(hex: string): boolean {
  try {
    return relativeLuminance(hex) > NEAR_WHITE_LUMINANCE;
  } catch {
    return false;
  }
}

/**
 * Deriva `--brand-accent`/`--brand-accent-contrast` para elementos sobre fondo
 * blanco (iconos, texto de botón) donde ni `primary` ni `secondary` son
 * universalmente seguros: CGCOM tiene `primaryColor` blanco (pensado como
 * superficie, no como acento) y Calidalia tiene `secondaryColor` amarillo
 * (tan claro como el blanco, ilegible sobre blanco). Se prioriza `primary`
 * salvo que sea casi blanco, en cuyo caso se usa `secondary`.
 */
function deriveAccentTokens(tokens: Record<string, string>): Record<string, string> {
  const primaryIsUsable = !isNearWhite(tokens['--brand-primary']);
  return {
    '--brand-accent': primaryIsUsable ? tokens['--brand-primary'] : tokens['--brand-secondary'],
    '--brand-accent-contrast': primaryIsUsable
      ? tokens['--brand-primary-contrast']
      : tokens['--brand-secondary-contrast'],
  };
}

function sanitizeTokens(colors: unknown): Record<string, string> {
  const tokens: Record<string, string> = { ...DEFAULT_EUDISTACK_BRANDING.tokens };
  if (!colors || typeof colors !== 'object') {
    return { ...tokens, ...deriveAccentTokens(tokens) };
  }
  for (const [token, field] of Object.entries(TOKEN_FIELD_MAP)) {
    const value = (colors as Record<string, unknown>)[field];
    if (isNonEmptyString(value) && CSS_COLOR_PATTERN.test(value.trim())) {
      tokens[token] = value.trim();
    }
  }
  return { ...tokens, ...deriveAccentTokens(tokens) };
}

function sanitizeField(raw: unknown, fallback: string): string {
  return isNonEmptyString(raw) ? raw.trim() : fallback;
}

/**
 * Resuelve un `TenantBranding` completo y válido a partir de la configuración
 * del portal (`GET /config`), o `null` si no está disponible. Nunca lanza
 * (ES-01): cada campo se valida por separado y uno inválido cae al valor
 * neutro sin invalidar el resto (EC-03). Sin configuración → exactamente
 * `DEFAULT_EUDISTACK_BRANDING`, nunca la marca de un tenant previo (R-2).
 */
export function resolveTenantBranding(config: PortalConfig | null): TenantBranding {
  try {
    if (!config) {
      return DEFAULT_EUDISTACK_BRANDING;
    }
    const languages = config.languages.filter(isNonEmptyString).map((lang) => lang.trim());
    return {
      tokens: sanitizeTokens(config.branding?.colors),
      logoUrl: sanitizeField(config.branding?.logo_url, DEFAULT_EUDISTACK_BRANDING.logoUrl),
      // El contrato no trae favicon ni nombre del tenant.
      faviconUrl: DEFAULT_EUDISTACK_BRANDING.faviconUrl,
      appName: DEFAULT_EUDISTACK_BRANDING.appName,
      defaultLanguage: languages[0] ?? DEFAULT_EUDISTACK_BRANDING.defaultLanguage,
      supportedLanguages: languages.length > 0 ? languages : [...DEFAULT_EUDISTACK_BRANDING.supportedLanguages],
    };
  } catch {
    return DEFAULT_EUDISTACK_BRANDING;
  }
}
