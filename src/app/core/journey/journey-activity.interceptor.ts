import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { ISSUANCE_PORTAL_API_BASE_PATH } from '../api/issuance-portal-api.providers';
import { JourneyInactivityService } from './journey-inactivity.service';

/** Cada llamada al servicio del portal reinicia el temporizador de inactividad, como `last_activity` en el servicio. */
export const journeyActivityInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(`${ISSUANCE_PORTAL_API_BASE_PATH}/`)) {
    inject(JourneyInactivityService).touch();
  }
  return next(req);
};
