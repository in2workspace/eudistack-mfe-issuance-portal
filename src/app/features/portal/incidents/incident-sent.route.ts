import { inject } from '@angular/core';
import { CanActivateFn, ResolveFn, Router } from '@angular/router';

/** Ruta de Ayuda (wireframes, Ayuda). */
export const INCIDENTS_PATH = 'incidents';

/** Ruta de Ayuda enviada (wireframes, Ayuda enviada). */
export const INCIDENT_SENT_PATH = `${INCIDENTS_PATH}/sent`;

/** Estado de la navegación de Ayuda a Ayuda enviada: el plazo que devuelve `POST /incidents`. */
export interface IncidentSentState {
  responseTime: string;
}

function responseTimeOfCurrentNavigation(): string | null {
  const state = inject(Router).getCurrentNavigation()?.extras.state as Partial<IncidentSentState> | undefined;
  return typeof state?.responseTime === 'string' ? state.responseTime : null;
}

/**
 * Ayuda enviada solo se alcanza al enviar una incidencia, con su plazo en
 * memoria. Un enlace directo o una recarga llevan a Inicio (EC-05).
 */
export const incidentSentGuard: CanActivateFn = () =>
  responseTimeOfCurrentNavigation() === null ? inject(Router).createUrlTree(['/']) : true;

export const incidentResponseTimeResolver: ResolveFn<string> = () => responseTimeOfCurrentNavigation() ?? '';
