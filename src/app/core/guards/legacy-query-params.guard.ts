import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LOGIN_CALLBACK_PATH } from '../auth/oidc-config';

/** Parámetros con los que la demo anterior pasaba la identidad del titular por la dirección. */
const LEGACY_QUERY_PARAMS = ['u', 'code', 'identified'];

/** Parámetros con los que el Verifier vuelve a la ruta de la vuelta: `code` es uno de ellos (EC-05). */
const LOGIN_CALLBACK_PARAMS = ['code'];

/**
 * Quita de la dirección los parámetros de la demo anterior (`?u=`, `?code=`,
 * `?identified=`): el portal no los lee (EC-01) y no deben quedarse en la
 * barra de direcciones, el historial ni el Referer (AC-05). La ruta de la
 * vuelta del Verifier conserva `code` y el resto de lo que trae (`state`,
 * `error`, `iss`) hasta que se canjea el código (EC-05).
 */
export const legacyQueryParamsGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const url = router.parseUrl(state.url);
  const isLoginCallback = url.root.children['primary']?.segments.map((segment) => segment.path).join('/') === LOGIN_CALLBACK_PATH;
  const legacy = LEGACY_QUERY_PARAMS.filter(
    (name) => name in url.queryParams && !(isLoginCallback && LOGIN_CALLBACK_PARAMS.includes(name)),
  );
  if (legacy.length === 0) {
    return true;
  }
  legacy.forEach((name) => delete url.queryParams[name]);
  return url;
};
