import { inject } from '@angular/core';
import { CanActivateFn, ResolveFn, Router } from '@angular/router';
import { IncidentSentStore } from './incident-sent.store';

/** Ruta de Ayuda (wireframes, Ayuda). */
export const INCIDENTS_PATH = 'incidents';

/** Ruta de Ayuda enviada (wireframes, Ayuda enviada). */
export const INCIDENT_SENT_PATH = `${INCIDENTS_PATH}/sent`;

/**
 * Ayuda enviada solo se alcanza justo después de enviar una incidencia. Un
 * enlace directo, una recarga o el historial llevan a Inicio (EC-05).
 */
export const incidentSentGuard: CanActivateFn = () =>
  inject(IncidentSentStore).has() ? true : inject(Router).createUrlTree(['/']);

export const incidentResponseTimeResolver: ResolveFn<string> = () => inject(IncidentSentStore).take();
