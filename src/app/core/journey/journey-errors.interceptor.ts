import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiProblemError, JOURNEY_CLOSED, STEP_NOT_ALLOWED } from '../api/api-problem.error';
import { ISSUANCE_PORTAL_API_BASE_PATH } from '../api/issuance-portal-api.providers';
import { JourneyNavigator } from './journey-navigator';

/** `GET /journey` lo trata quien lo pide (la guarda y el navegador), para no navegar dos veces. */
function isGetJourney(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url === `${ISSUANCE_PORTAL_API_BASE_PATH}/journey`;
}

/**
 * 409 y 410 de cualquier llamada al servicio (design.md §3.2): con
 * `journey_closed` lleva a sesión caducada y con `step_not_allowed`, a la
 * ruta del paso que indique `GET /journey`. El resto, `offer_not_renewable`
 * incluido, lo trata la pantalla que llamó. El error se propaga igualmente,
 * para que quien llamó no se quede esperando; las pantallas no muestran nada
 * para estos dos tipos. Va por fuera del interceptor de la API, que es quien
 * traduce los errores a `ApiProblemError`.
 */
export const journeyErrorsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${ISSUANCE_PORTAL_API_BASE_PATH}/`) || isGetJourney(req)) {
    return next(req);
  }
  const navigator = inject(JourneyNavigator);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiProblemError && error.type === JOURNEY_CLOSED) {
        void navigator.toSessionExpired();
      } else if (error instanceof ApiProblemError && error.type === STEP_NOT_ALLOWED) {
        void navigator.toCurrentStep();
      }
      return throwError(() => error);
    }),
  );
};
