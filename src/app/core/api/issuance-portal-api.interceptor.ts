import { InjectionToken, inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiProblemError, NETWORK_ERROR, UNEXPECTED_ERROR } from './api-problem.error';
import { ISSUANCE_PORTAL_API_BASE_PATH } from './issuance-portal-api.providers';

/**
 * Access Token del titular para las llamadas al servicio, o `null` si no hay.
 * Por defecto no hay ninguno: lo provee el cliente OIDC del Verifier (EUD-314).
 */
export const ISSUANCE_PORTAL_ACCESS_TOKEN = new InjectionToken<() => string | null>('ISSUANCE_PORTAL_ACCESS_TOKEN', {
  providedIn: 'root',
  factory: () => () => null,
});

/**
 * Llamadas al servicio del portal de emisión (design.md AD-2): añade el Access
 * Token como `Authorization: Bearer` cuando lo hay y traduce cualquier error a
 * `ApiProblemError`. Sin cookie de sesión, no lleva `withCredentials` ni
 * cabecera anti-CSRF. El resto de peticiones (ficheros de idioma, theme.json)
 * pasan sin cambios y nunca llevan el token.
 */
export const issuancePortalApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${ISSUANCE_PORTAL_API_BASE_PATH}/`)) {
    return next(req);
  }
  const token = inject(ISSUANCE_PORTAL_ACCESS_TOKEN)();
  const apiReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
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
