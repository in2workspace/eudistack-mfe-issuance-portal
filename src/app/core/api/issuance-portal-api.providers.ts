import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideApi as provideJourneyApi } from './generated/journey';
import { provideApi as provideIdentificationApi } from './generated/identification';
import { provideApi as provideAuthenticSourceApi } from './generated/authentic-source';

/**
 * Ruta de la API del servicio del portal de emisión, relativa al host del
 * tenant. El servidor de los contratos es una URL de ejemplo
 * (`sandbox.stg`): la interfaz siempre llama al mismo host que la sirve.
 */
export const ISSUANCE_PORTAL_API_BASE_PATH = '/issuance-portal/api/v1';

/**
 * Clientes generados de los contratos de los tres módulos del servicio
 * (design.md AD-2): Recorrido, Identificación y Fuente auténtica.
 */
export function provideIssuancePortalApi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideJourneyApi(ISSUANCE_PORTAL_API_BASE_PATH),
    provideIdentificationApi(ISSUANCE_PORTAL_API_BASE_PATH),
    provideAuthenticSourceApi(ISSUANCE_PORTAL_API_BASE_PATH),
  ]);
}
