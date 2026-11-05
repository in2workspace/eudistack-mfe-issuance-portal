import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Journey, JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { DATA_PATH, ENTITLEMENT_PATH, QR_PATH } from './journey-paths';
import { JourneyNavigator, isJourneyClosed, stepUrl } from './journey-navigator';

/**
 * Pasos con los que se puede estar en cada ruta. QR admite también
 * `entitlement_confirmed`: QR (generando) es quien pide la confirmación.
 */
const ALLOWED_STEPS: Record<string, readonly Journey.StepEnum[]> = {
  [ENTITLEMENT_PATH]: ['identified'],
  [DATA_PATH]: ['entitlement_confirmed'],
  [QR_PATH]: ['entitlement_confirmed', 'offer_obtained'],
};

/**
 * Guarda de los pasos del recorrido (prd.md §3.3, design.md AD-3): el paso
 * lo dice `GET /journey`, no el navegador. Si no corresponde a la ruta, lleva
 * a la del paso; un recorrido que ya no está en curso lleva a Inicio y uno
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
    const allowed = journey.state === 'in_progress' && ALLOWED_STEPS[route.routeConfig?.path ?? '']?.includes(journey.step);
    return allowed ? true : router.createUrlTree(stepUrl(journey));
  } catch (error: unknown) {
    return router.createUrlTree(isJourneyClosed(error) ? navigator.expireSession() : ['/']);
  }
};
