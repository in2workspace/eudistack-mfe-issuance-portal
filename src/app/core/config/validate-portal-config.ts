import { PortalConfig } from '../api/generated/journey';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Comprueba que `GET /config` trae lo que el contrato marca como obligatorio:
 * `texts`, `support`, `legal_links` y `wallet_url` (una URL `https`), y que
 * cada enlace de `legal_links` es `https` o una ruta del propio host. En el
 * contrato `support` no trae enlaces (correo, teléfono, horario y plazo), así
 * que no se valida como URL. La marca y los idiomas no vienen de aquí, sino
 * del `theme.json` del tenant. Una configuración que no lo cumple es como no
 * tenerla (ES-02): la interfaz muestra "configuración no disponible".
 */
export function validatePortalConfig(raw: unknown): PortalConfig | null {
  if (!isObject(raw)) {
    return null;
  }
  const { texts, support, legal_links, wallet_url } = raw;
  if (!isObject(texts) || !isObject(support) || !isObject(legal_links)) {
    return null;
  }
  if (!isHttpsUrl(wallet_url)) {
    return null;
  }
  if (!Object.values(legal_links).every(isSafeLink)) {
    return null;
  }
  return raw as unknown as PortalConfig;
}

/**
 * Los enlaces legales acabarán en un `href`: solo `https:` o una ruta del
 * propio host (`/terminos`). Se rechazan `javascript:`, `data:`, `//otro-host`
 * y cualquier otro esquema.
 */
function isSafeLink(value: unknown): boolean {
  if (typeof value === 'string' && value.startsWith('/')) {
    try {
      return new URL(value, globalThis.location.origin).origin === globalThis.location.origin;
    } catch {
      return false;
    }
  }
  return isHttpsUrl(value);
}

/** La dirección del wallet acaba en el QR y en un enlace: solo `https:`. */
function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
