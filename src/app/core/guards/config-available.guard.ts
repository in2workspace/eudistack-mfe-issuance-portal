import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortalConfigService } from '../config/portal-config.service';
import { ERROR_PATH } from '../../features/error/error-reason';

/** Ruta del caso "configuración no disponible" de la pantalla de error (prd.md §3.4). */
export const CONFIG_UNAVAILABLE_PATH = `${ERROR_PATH}/config-unavailable`;

/** Sin configuración del tenant, cualquier pantalla lleva al caso de configuración no disponible. */
export const configAvailableGuard: CanActivateFn = () =>
  inject(PortalConfigService).state().status === 'unavailable'
    ? inject(Router).createUrlTree([`/${CONFIG_UNAVAILABLE_PATH}`])
    : true;

/** El caso de configuración no disponible solo se ve cuando lo está. */
export const configUnavailableGuard: CanActivateFn = () =>
  inject(PortalConfigService).state().status === 'loaded' ? inject(Router).createUrlTree(['/']) : true;
