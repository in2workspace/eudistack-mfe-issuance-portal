import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiProblemError, JOURNEY_CLOSED } from '../api/api-problem.error';
import { Journey, JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { errorUrl } from '../../features/error/error-reason';
import { DATA_PATH, ENTITLEMENT_PATH, QR_PATH } from './journey-paths';

/** Ruta del último paso alcanzado del recorrido. */
export const STEP_PATH: Record<Journey.StepEnum, string> = {
  identified: ENTITLEMENT_PATH,
  entitlement_confirmed: DATA_PATH,
  offer_obtained: QR_PATH,
};

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
  const home = router.createUrlTree(['/']);
  if (!inject(ISSUANCE_PORTAL_ACCESS_TOKEN)()) {
    return home;
  }
  const journeyApi = inject(JourneyApi);
  try {
    const journey = await firstValueFrom(journeyApi.getJourney());
    return decide(journey, route.routeConfig?.path ?? '', router) ?? true;
  } catch (error: unknown) {
    return error instanceof ApiProblemError && error.type === JOURNEY_CLOSED
      ? router.createUrlTree(errorUrl('session-expired'))
      : home;
  }
};

/** `null` si el titular puede estar en la ruta; si no, adónde va. */
function decide(journey: Journey, path: string, router: Router): UrlTree | null {
  if (journey.state !== 'in_progress') {
    return router.createUrlTree(['/']);
  }
  if (ALLOWED_STEPS[path]?.includes(journey.step)) {
    return null;
  }
  return router.createUrlTree(['/', STEP_PATH[journey.step]]);
}
