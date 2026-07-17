import {
  DEFAULT_EUDISTACK_BRANDING,
  TenantBranding,
  TenantBrandingDescriptor,
  TenantBrandingResult,
} from './tenant-branding.model';

/** Allow-list de CSS custom properties que un descriptor de tenant puede fijar (R-6). */
const ALLOWED_TOKEN_KEYS = Object.keys(DEFAULT_EUDISTACK_BRANDING.tokens);

/** Mismo patrón de validación de color que `ThemeService` (Wallet PWA, SAD §8.8) — defensa en profundidad ante inyección de valores CSS (R-6). */
const CSS_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeTokens(raw: unknown): Record<string, string> {
  const tokens: Record<string, string> = { ...DEFAULT_EUDISTACK_BRANDING.tokens };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return tokens;
  }
  const source = raw as Record<string, unknown>;
  for (const key of ALLOWED_TOKEN_KEYS) {
    const value = source[key];
    if (isNonEmptyString(value) && CSS_COLOR_PATTERN.test(value.trim())) {
      tokens[key] = value.trim();
    }
  }
  return tokens;
}

function sanitizeField(raw: unknown, fallback: string): string {
  return isNonEmptyString(raw) ? raw.trim() : fallback;
}

function sanitizeSupportedLanguages(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_EUDISTACK_BRANDING.supportedLanguages];
  }
  const languages = raw.filter(isNonEmptyString).map(lang => lang.trim());
  return languages.length > 0 ? languages : [...DEFAULT_EUDISTACK_BRANDING.supportedLanguages];
}

/**
 * Resuelve un `TenantBranding` completo y válido a partir del resultado fail-safe
 * de cargar el descriptor del tenant (o `null` cuando la identidad de tenant no
 * fue resoluble — ES-03). Nunca lanza (ES-01): valida y sanitiza cada campo por
 * separado; uno inválido cae al valor neutro correspondiente sin invalidar el
 * resto (EC-02). Sin descriptor válido → exactamente `DEFAULT_EUDISTACK_BRANDING`
 * (EC-01, ES-02/ES-03/ES-04/ES-05) — nunca el branding de un tenant previo (R-2).
 */
export function resolveTenantBranding(result: TenantBrandingResult | null): TenantBranding {
  try {
    if (!result || !result.ok) {
      return DEFAULT_EUDISTACK_BRANDING;
    }

    const descriptor: TenantBrandingDescriptor = result.descriptor ?? {};

    return {
      tokens: sanitizeTokens(descriptor.tokens),
      logoUrl: sanitizeField(descriptor.logoUrl, DEFAULT_EUDISTACK_BRANDING.logoUrl),
      faviconUrl: sanitizeField(descriptor.faviconUrl, DEFAULT_EUDISTACK_BRANDING.faviconUrl),
      appName: sanitizeField(descriptor.appName, DEFAULT_EUDISTACK_BRANDING.appName),
      defaultLanguage: sanitizeField(descriptor.defaultLanguage, DEFAULT_EUDISTACK_BRANDING.defaultLanguage),
      supportedLanguages: sanitizeSupportedLanguages(descriptor.supportedLanguages),
    };
  } catch {
    return DEFAULT_EUDISTACK_BRANDING;
  }
}
