import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Journey, JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { DATA_PATH, EMAIL_PATH, ENTITLEMENT_PATH, QR_PATH } from './journey-paths';
import {
  JourneyNavigator,
  hasConfirmedEntitlement,
  hasPendingEmailCode,
  hasVerifiedEmail,
  isJourneyActive,
  isJourneyClosed,
  stepUrl,
} from './journey-navigator';

/**
 * Cuándo se puede estar en cada ruta. Datos se puede ver con el derecho
 * confirmado y sin oferta, con el correo verificado o no, porque Cambiar el
 * correo y el botón atrás de Verificar correo vuelven a ella. Verificar correo
 * pide un código pendiente. QR pide el correo verificado (QR, generando, es
 * quien pide la confirmación) o una oferta ya obtenida.
 */
const ALLOWED: Record<string, (journey: Journey) => boolean> = {
  [ENTITLEMENT_PATH]: (journey) => journey.step === 'identified',
  [DATA_PATH]: hasConfirmedEntitlement,
  [EMAIL_PATH]: hasPendingEmailCode,
  [QR_PATH]: (journey) => journey.step === 'offer_obtained' || hasVerifiedEmail(journey),
};

/**
 * Guarda de los pasos del recorrido (prd.md §3.3, design.md AD-3): el paso
 * lo dice `GET /journey`, no el navegador. Si no corresponde a la ruta, lleva
 * a la que toca (`stepUrl`); un recorrido sin paso (`isJourneyActive`) lleva a Inicio y uno
 * caducado (410), a sesión caducada. Sin token o con 401 va a Inicio; la
 * renovación del token y la vuelta al Verifier son de EUD-314.
 */
export const journeyStepGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  if (!inject(ISSUANCE_PORTAL_ACCESS_TOKEN)()) {
    return router.createUrlTree(['/']);
  }
  const journeyApi = inject(JourneyApi);
  const navigator = inject(JourneyNavigator);
  try {
    const journey = await firstValueFrom(journeyApi.getJourney());
    const allowed = isJourneyActive(journey) && ALLOWED[route.routeConfig?.path ?? '']?.(journey) === true;
    return allowed ? true : router.createUrlTree(stepUrl(journey));
  } catch (error: unknown) {
    return router.createUrlTree(isJourneyClosed(error) ? navigator.expireSession() : ['/']);
  }
};
