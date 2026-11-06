import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { ISSUANCE_PORTAL_API_BASE_PATH, isIncidentRequest } from '../api/issuance-portal-api.providers';
import { JourneyInactivityService } from './journey-inactivity.service';

/**
 * Cada llamada al servicio del portal reinicia el temporizador de inactividad,
 * como `last_activity` en el servicio. El envío de una incidencia no: va sin
 * token y el servicio no lo asocia al recorrido.
 */
export const journeyActivityInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(`${ISSUANCE_PORTAL_API_BASE_PATH}/`) && !isIncidentRequest(req)) {
    inject(JourneyInactivityService).touch();
  }
  return next(req);
};
