import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IssuanceStateService } from '../services/issuance-state.service';

/**
 * Protege las rutas que requieren usuario autenticado.
 * Si `authenticatedUser` es nulo, redirige a /portal.
 */
export const authGuard: CanActivateFn = () => {
  const state = inject(IssuanceStateService);
  const router = inject(Router);

  if (state.authenticatedUser() !== null) {
    return true;
  }
  return router.createUrlTree(['/portal']);
};
