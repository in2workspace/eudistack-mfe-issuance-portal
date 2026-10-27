import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Guarda provisional de los pasos Datos y QR: siempre vuelve a Inicio. La
 * interfaz ya no guarda el usuario en el navegador (design.md AD-3) y aún no
 * consulta el paso del recorrido al servicio. La sustituye la guarda con
 * `GET /journey` (EUD-287).
 */
export const pendingJourneyGuard: CanActivateFn = () => inject(Router).createUrlTree(['/']);
