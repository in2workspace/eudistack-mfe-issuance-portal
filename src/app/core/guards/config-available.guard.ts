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

/**
 * Estado de navegación con el que se llega al caso de configuración no
 * disponible cuando es el servicio quien la da por incompleta (503
 * `config_unavailable` al abrir el recorrido), aunque `GET /config` haya
 * respondido.
 */
export const SERVICE_CONFIG_UNAVAILABLE_STATE = { serviceConfigUnavailable: true };

/** El caso de configuración no disponible solo se ve cuando lo está, o cuando el servicio lo ha dicho. */
export const configUnavailableGuard: CanActivateFn = () => {
  const router = inject(Router);
  const reportedByService = router.getCurrentNavigation()?.extras.state?.['serviceConfigUnavailable'] === true;
  return inject(PortalConfigService).state().status === 'loaded' && !reportedByService ? router.createUrlTree(['/']) : true;
};
