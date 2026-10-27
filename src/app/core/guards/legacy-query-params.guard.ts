import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Parámetros con los que la demo anterior pasaba la identidad del titular por la dirección. */
const LEGACY_QUERY_PARAMS = ['u', 'code', 'identified'];

/**
 * Quita de la dirección los parámetros de la demo anterior (`?u=`, `?code=`,
 * `?identified=`): el portal no los lee (EC-01) y no deben quedarse en la
 * barra de direcciones, el historial ni el Referer (AC-05).
 */
export const legacyQueryParamsGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const url = router.parseUrl(state.url);
  const legacy = LEGACY_QUERY_PARAMS.filter((name) => name in url.queryParams);
  if (legacy.length === 0) {
    return true;
  }
  legacy.forEach((name) => delete url.queryParams[name]);
  return url;
};
