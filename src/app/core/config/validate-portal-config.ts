import { PortalConfig } from '../api/generated/journey';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Comprueba que `GET /config` trae lo que el contrato marca como obligatorio:
 * `texts`, `support`, `legal_links` y `wallet_url`. La marca y los idiomas no
 * vienen de aquí, sino del `theme.json` del tenant. Una configuración que no
 * lo cumple es como no tenerla (ES-02): la interfaz muestra "configuración no
 * disponible".
 */
export function validatePortalConfig(raw: unknown): PortalConfig | null {
  if (!isObject(raw)) {
    return null;
  }
  const { texts, support, legal_links, wallet_url } = raw;
  if (!isObject(texts) || !isObject(support) || !isObject(legal_links)) {
    return null;
  }
  if (typeof wallet_url !== 'string' || wallet_url.trim().length === 0) {
    return null;
  }
  return raw as unknown as PortalConfig;
}
