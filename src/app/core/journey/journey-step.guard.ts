import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Journey, JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { SESSION_ACTIONS } from '../session/session-actions';
import { DATA_ROUTE, EMAIL_PATH, ENTITLEMENT_PATH, QR_ROUTE, REQUESTS_PATH, REQUEST_ID_PARAM } from './journey-paths';
import {
  JourneyNavigator,
  isAvailable,
  isEmailVerified,
  isJourneyActive,
  isJourneyClosed,
  requestOf,
  stepUrl,
} from './journey-navigator';

/**
 * Cuándo se puede estar en cada ruta (design.md AD-8, AD-9). Correo, con las
 * solicitudes obtenidas y el correo sin verificar: el estado del correo y el
 * del código los distingue la pantalla. Solicitudes pide el correo verificado.
 * Datos y QR piden además que `requestId` sea una solicitud del recorrido en
 * un estado que permita la pantalla: Datos, disponible; QR, disponible
 * (generando, confirma) o con oferta (recarga o código nuevo). Cualquier otra
 * (no disponible, guardada o que no es suya) lleva al paso que toca (EC-07).
 */
const ALLOWED: Record<string, (journey: Journey, requestId: string | null) => boolean> = {
  [ENTITLEMENT_PATH]: (journey) => journey.step === 'identified',
  [EMAIL_PATH]: (journey) => journey.step !== 'identified' && !isEmailVerified(journey),
  [REQUESTS_PATH]: isEmailVerified,
  [DATA_ROUTE]: (journey, requestId) => isEmailVerified(journey) && isAvailable(requestOf(journey, requestId)),
  [QR_ROUTE]: (journey, requestId) => {
    const status = requestOf(journey, requestId)?.status;
    return isEmailVerified(journey) && (status === 'available' || status === 'in_offer');
  },
};

/**
 * Guarda de los pasos del recorrido (prd.md §3.3, design.md AD-3): el paso
 * lo dice `GET /journey`, no el navegador. Si no corresponde a la ruta, lleva
 * a la que toca (`stepUrl`); un recorrido sin paso (`isJourneyActive`) lleva a Inicio y uno
 * caducado (410), a sesión caducada. Sin token (el titular recargó la página)
 * intenta el login sin interacción y cancela la navegación: a la vuelta, el
 * callback abre el recorrido y vuelve a esta ruta, que la guarda vuelve a
 * comprobar (AC-07, EC-06). La renovación del token
 * ante un 401 es del interceptor `tokenRenewalInterceptor`.
 */
export const journeyStepGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  if (!inject(ISSUANCE_PORTAL_ACCESS_TOKEN)()) {
    await inject(SESSION_ACTIONS).resumeLogin(state.url);
    return false;
  }
  const journeyApi = inject(JourneyApi);
  const navigator = inject(JourneyNavigator);
  try {
    const journey = await firstValueFrom(journeyApi.getJourney());
    const requestId = route.paramMap.get(REQUEST_ID_PARAM);
    const allowed = isJourneyActive(journey) && ALLOWED[route.routeConfig?.path ?? '']?.(journey, requestId) === true;
    return allowed ? true : router.createUrlTree(stepUrl(journey));
  } catch (error: unknown) {
    return router.createUrlTree(isJourneyClosed(error) ? navigator.expireSession() : ['/']);
  }
};
