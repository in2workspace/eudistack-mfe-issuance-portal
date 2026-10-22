import { PortalConfig } from '../api/generated/journey';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Comprueba que `GET /config` trae lo que el contrato marca como obligatorio
 * (branding, languages, texts, support, legal_links) y al menos un idioma.
 * Una configuración que no lo cumple es como no tenerla (ES-03): la interfaz
 * muestra "configuración no disponible".
 */
export function validatePortalConfig(raw: unknown): PortalConfig | null {
  if (!isObject(raw)) {
    return null;
  }
  const { branding, languages, texts, support, legal_links } = raw;
  if (!isObject(branding) || !isObject(texts) || !isObject(support) || !isObject(legal_links)) {
    return null;
  }
  if (!Array.isArray(languages)) {
    return null;
  }
  const validLanguages = languages.filter((lang): lang is string => typeof lang === 'string' && lang.trim().length > 0);
  if (validLanguages.length === 0) {
    return null;
  }
  return { ...(raw as unknown as PortalConfig), languages: validLanguages.map((lang) => lang.trim()) };
}
