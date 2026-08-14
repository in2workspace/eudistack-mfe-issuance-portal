import {
  IDENTIFICATION_CORRELATION_MODES,
  IdentificationCorrelationMode,
  TenantIdentificationConfig,
  TenantIdentificationConfigResult,
} from './tenant-identification-config.model';
import { validateIdentificationUrl } from './validate-identification-url';

/**
 * Puerto mínimo hacia la fuente de config por tenant — desacoplado de
 * `TenantPortalConfigSource` a propósito (capa de dominio sin dependencias
 * de framework). El adapter real (`TenantPortalConfigSource`, extendido en
 * T9) satisface esta forma con su método `read(tenant)`.
 */
export interface IdentificationConfigSource {
  read(tenant: string): {
    identificationUrl?: unknown;
    identificationCorrelationMode?: unknown;
    identificationCorrelationParam?: unknown;
  } | null;
}

/**
 * Resuelve la config de identificación del carril "Certificado Digital"
 * para un tenant. Fail-closed en las tres formas de fallo (AD-3/AD-5):
 * config ausente, destino con forma no admitida, o modo/`correlationParam`
 * inválidos — nunca sustituye por un destino por defecto.
 */
export function resolveTenantIdentificationConfig(
  tenant: string,
  source: IdentificationConfigSource,
): TenantIdentificationConfigResult {
  const raw = source.read(tenant);
  if (!raw) {
    return { ok: false, reason: 'config_absent' };
  }

  const { identificationUrl, identificationCorrelationMode, identificationCorrelationParam } = raw;
  if (identificationUrl === undefined || identificationCorrelationMode === undefined) {
    return { ok: false, reason: 'config_absent' };
  }
  if (!validateIdentificationUrl(identificationUrl)) {
    return { ok: false, reason: 'identification_url_invalid' };
  }
  if (!isValidCorrelationMode(identificationCorrelationMode)) {
    return { ok: false, reason: 'correlation_mode_invalid' };
  }
  if (
    identificationCorrelationMode === 'echo' &&
    (typeof identificationCorrelationParam !== 'string' || identificationCorrelationParam.length === 0)
  ) {
    return { ok: false, reason: 'correlation_param_absent' };
  }

  const config: TenantIdentificationConfig = {
    url: identificationUrl,
    correlationMode: identificationCorrelationMode,
    correlationParam:
      typeof identificationCorrelationParam === 'string' ? identificationCorrelationParam : undefined,
  };
  return { ok: true, config };
}

function isValidCorrelationMode(value: unknown): value is IdentificationCorrelationMode {
  return typeof value === 'string' && IDENTIFICATION_CORRELATION_MODES.includes(value as IdentificationCorrelationMode);
}
