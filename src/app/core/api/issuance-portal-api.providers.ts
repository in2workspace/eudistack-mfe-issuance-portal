import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { HttpRequest } from '@angular/common/http';
import { provideApi as provideJourneyApi } from './generated/journey';
import { provideApi as provideAuthenticSourceApi } from './generated/authentic-source';

/**
 * Ruta de la API del servicio del portal de emisión, relativa al host del
 * tenant. El servidor de los contratos es una URL de ejemplo
 * (`sandbox.stg`): la interfaz siempre llama al mismo host que la sirve.
 */
export const ISSUANCE_PORTAL_API_BASE_PATH = '/issuance-portal/api/v1';

/**
 * `POST /incidents` es público (`security: []`): el titular puede enviarlo
 * antes de identificarse, y no lleva el Access Token ni cuenta como actividad
 * del recorrido aunque lo haya.
 */
export function isIncidentRequest(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url.split('?')[0] === `${ISSUANCE_PORTAL_API_BASE_PATH}/incidents`;
}

/**
 * Clientes generados de los contratos de los dos módulos del servicio
 * (design.md AD-2): Recorrido y Fuente auténtica.
 */
export function provideIssuancePortalApi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideJourneyApi(ISSUANCE_PORTAL_API_BASE_PATH),
    provideAuthenticSourceApi(ISSUANCE_PORTAL_API_BASE_PATH),
  ]);
}
