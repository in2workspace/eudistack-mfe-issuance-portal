import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortalConfigService } from '../config/portal-config.service';

/** Ruta de la pantalla "configuración no disponible" (prd.md §3.4). */
export const CONFIG_UNAVAILABLE_PATH = 'unavailable';

/** Sin configuración del tenant, cualquier pantalla lleva a la de configuración no disponible. */
export const configAvailableGuard: CanActivateFn = () =>
  inject(PortalConfigService).state().status === 'unavailable'
    ? inject(Router).createUrlTree([`/${CONFIG_UNAVAILABLE_PATH}`])
    : true;

/** La pantalla de configuración no disponible solo se ve cuando lo está. */
export const configUnavailableGuard: CanActivateFn = () =>
  inject(PortalConfigService).state().status === 'loaded' ? inject(Router).createUrlTree(['/']) : true;
