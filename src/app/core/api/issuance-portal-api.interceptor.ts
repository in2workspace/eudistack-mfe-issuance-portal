import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiProblemError, NETWORK_ERROR, UNEXPECTED_ERROR } from './api-problem.error';
import { ISSUANCE_PORTAL_API_BASE_PATH } from './issuance-portal-api.providers';

const REQUESTED_WITH = 'X-Requested-With';
const REQUESTED_WITH_VALUE = 'issuance-portal';

/**
 * Llamadas al servicio del portal de emisión (design.md AD-2): envía la
 * cookie de la sesión del recorrido, la cabecera que el servicio exige en las
 * peticiones que cambian estado (AD-9 del servicio) y traduce cualquier error
 * a `ApiProblemError`. El resto de peticiones (ficheros de idioma, assets)
 * pasan sin cambios.
 */
export const issuancePortalApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${ISSUANCE_PORTAL_API_BASE_PATH}/`)) {
    return next(req);
  }
  const apiReq = req.clone({
    withCredentials: true,
    setHeaders: { [REQUESTED_WITH]: REQUESTED_WITH_VALUE },
  });
  return next(apiReq).pipe(catchError((err: unknown) => throwError(() => toApiProblemError(err))));
};

function toApiProblemError(err: unknown): ApiProblemError {
  if (!(err instanceof HttpErrorResponse)) {
    return new ApiProblemError(UNEXPECTED_ERROR, 0, 'Unexpected error');
  }
  if (err.status === 0) {
    return new ApiProblemError(NETWORK_ERROR, 0, 'Network error');
  }
  const body: unknown = err.error;
  if (isProblem(body)) {
    return new ApiProblemError(body.type, body.status, body.title);
  }
  return new ApiProblemError(UNEXPECTED_ERROR, err.status, 'Unexpected error');
}

function isProblem(body: unknown): body is { type: string; title: string; status: number } {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const problem = body as Record<string, unknown>;
  return typeof problem['type'] === 'string' && typeof problem['title'] === 'string' && typeof problem['status'] === 'number';
}
