import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IdentificationReturnService } from '../../features/identification/identification-return.service';

/**
 * Segunda capa de defensa (AD-6) sobre `user-data`, junto al `authGuard`
 * existente. Deniega solo `rejected`; permite `correlated` **y**
 * `out_of_scope` explícitamente — denegar `out_of_scope` rompería los 4
 * métodos de identificación fuera de alcance de esta Story (AC-08).
 *
 * Solo lee la signal ya calculada por `IdentificationReturnService.
 * handleReturn()` — no re-evalúa ni re-consume la referencia (el uso único
 * de AC-05 se sella una sola vez, en `app.component.ts`).
 */
export const identificationReturnGuard: CanActivateFn = () => {
  const identificationReturn = inject(IdentificationReturnService);
  const router = inject(Router);

  if (identificationReturn.outcome() === 'rejected') {
    return router.createUrlTree(['/']);
  }
  return true;
};
