import { PortalConfigSupport } from '../api/generated/journey';

/**
 * Si el tenant da algún dato de contacto del soporte (correo, teléfono u
 * horario). El plazo de respuesta no cuenta, porque no es un contacto.
 */
export function hasSupportDetails(support: PortalConfigSupport | null | undefined): support is PortalConfigSupport {
  return Boolean(support?.email || support?.phone || support?.schedule);
}
