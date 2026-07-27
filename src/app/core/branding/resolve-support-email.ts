import { resolveTenantIdentity } from './resolve-tenant-identity';
import { environment } from '../../../environments/environment';

/**
 * Dirección de contacto de soporte, derivada del tenant resuelto
 * (`soporte@{tenant}-identidad.es`) en vez de fija a `cgcom-identidad.es`.
 * Sin tenant resoluble, cae al dominio neutro EUDIStack.
 */
export function resolveSupportEmail(): string {
  const tenant = resolveTenantIdentity(window.location, environment) ?? 'eudistack';
  return `soporte@${tenant}-identidad.es`;
}
