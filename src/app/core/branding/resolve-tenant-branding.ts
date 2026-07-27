import {
  DEFAULT_EUDISTACK_BRANDING,
  TenantBranding,
  TenantBrandingDescriptor,
  TenantBrandingResult,
} from './tenant-branding.model';

type BrandingDescriptor = NonNullable<TenantBrandingDescriptor['branding']>;

/** Mapea cada CSS custom property (allow-list, R-6) al campo del `theme.json` real que la alimenta. */
const TOKEN_FIELD_MAP: Record<string, keyof BrandingDescriptor> = {
  '--brand-primary': 'primaryColor',
  '--brand-primary-contrast': 'primaryContrastColor',
  '--brand-secondary': 'secondaryColor',
  '--brand-secondary-contrast': 'secondaryContrastColor',
};

/** Mismo patrón de validación de color que `ThemeService` (Wallet PWA, SAD §8.8) — defensa en profundidad ante inyección de valores CSS (R-6). */
const CSS_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeTokens(branding: BrandingDescriptor | undefined): Record<string, string> {
  const tokens: Record<string, string> = { ...DEFAULT_EUDISTACK_BRANDING.tokens };
  if (!branding || typeof branding !== 'object') {
    return tokens;
  }
  for (const [token, field] of Object.entries(TOKEN_FIELD_MAP)) {
    const value = branding[field];
    if (isNonEmptyString(value) && CSS_COLOR_PATTERN.test(value.trim())) {
      tokens[token] = value.trim();
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
 * separado desde la forma anidada real (`descriptor.branding.*`,
 * `descriptor.i18n.*` — mismo contrato que `theme.json` en la Wallet PWA); uno
 * inválido cae al valor neutro correspondiente sin invalidar el resto (EC-02).
 * Sin descriptor válido → exactamente `DEFAULT_EUDISTACK_BRANDING` (EC-01,
 * ES-02/ES-03/ES-04/ES-05) — nunca el branding de un tenant previo (R-2).
 */
export function resolveTenantBranding(result: TenantBrandingResult | null): TenantBranding {
  try {
    if (!result || !result.ok) {
      return DEFAULT_EUDISTACK_BRANDING;
    }

    const descriptor: TenantBrandingDescriptor = result.descriptor ?? {};
    const branding = descriptor.branding;
    const i18n = descriptor.i18n;

    // Todos los headers de este repo tienen fondo blanco (AD-2): se prioriza
    // la variante oscura del logo (contraste sobre claro); si el tenant no
    // la publica, se usa `logoUrl` tal cual (caso CGCOM, sin `logoDarkUrl`).
    const logoDarkUrl = branding?.logoDarkUrl;
    const logoUrl = isNonEmptyString(logoDarkUrl)
      ? logoDarkUrl.trim()
      : sanitizeField(branding?.logoUrl, DEFAULT_EUDISTACK_BRANDING.logoUrl);

    return {
      tokens: sanitizeTokens(branding),
      logoUrl,
      faviconUrl: sanitizeField(branding?.faviconUrl, DEFAULT_EUDISTACK_BRANDING.faviconUrl),
      appName: sanitizeField(branding?.name, DEFAULT_EUDISTACK_BRANDING.appName),
      defaultLanguage: sanitizeField(i18n?.defaultLang, DEFAULT_EUDISTACK_BRANDING.defaultLanguage),
      supportedLanguages: sanitizeSupportedLanguages(i18n?.available),
    };
  } catch {
    return DEFAULT_EUDISTACK_BRANDING;
  }
}
