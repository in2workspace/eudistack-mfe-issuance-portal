import { inject } from '@angular/core';
import { HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { NEVER, Observable, catchError, defer, from, switchMap, throwError } from 'rxjs';
import { ApiProblemError } from '../api/api-problem.error';
import { ISSUANCE_PORTAL_API_BASE_PATH, isIncidentRequest } from '../api/issuance-portal-api.providers';
import { HolderAuthService } from './holder-auth.service';

/** `POST /journey` abre el recorrido con el token recién emitido: un 401 ahí es identificación no completada, no un token que renovar. */
function isOpenJourney(req: HttpRequest<unknown>): boolean {
  return req.method === 'POST' && req.url === `${ISSUANCE_PORTAL_API_BASE_PATH}/journey`;
}

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiProblemError && error.status === 401;
}

/**
 * Renovación del Access Token (design.md §3.1, punto 5; AC-06, EC-06). Si el
 * token ya ha caducado al enviar, o el servicio responde 401, lo renueva con
 * el Refresh Token y repite la petición una vez. Si no puede renovarlo, o el
 * 401 se repite, lleva al titular al Verifier sin pantalla de error: la
 * petición queda sin respuesta porque la página se va, y a la vuelta el
 * callback devuelve el recorrido que ya existe. Las peticiones concurrentes
 * comparten una sola renovación (`HolderAuthService.renew`).
 *
 * Va entre el interceptor de errores del recorrido y el de la API: ve los
 * errores ya traducidos a `ApiProblemError` y, al repetir, la petición vuelve
 * a pasar por quien añade el token, que lee el nuevo.
 */
export const tokenRenewalInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${ISSUANCE_PORTAL_API_BASE_PATH}/`) || isIncidentRequest(req) || isOpenJourney(req)) {
    return next(req);
  }
  const auth = inject(HolderAuthService);

  const toVerifier = (): Observable<never> =>
    defer(() => {
      auth.redirectToVerifier();
      return NEVER;
    });
  const renewAndRetry = (): Observable<HttpEvent<unknown>> =>
    from(auth.renew()).pipe(
      switchMap((renewed) =>
        renewed
          ? next(req).pipe(catchError((error: unknown) => (isUnauthenticated(error) ? toVerifier() : throwError(() => error))))
          : toVerifier(),
      ),
    );

  if (auth.isAccessTokenExpired()) {
    return renewAndRetry();
  }
  return next(req).pipe(catchError((error: unknown) => (isUnauthenticated(error) ? renewAndRetry() : throwError(() => error))));
};
