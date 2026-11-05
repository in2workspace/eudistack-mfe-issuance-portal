import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiProblemError, JOURNEY_CLOSED } from '../api/api-problem.error';
import { Journey, JourneyApi } from '../api/generated/journey';
import { errorUrl } from '../../features/error/error-reason';
import { SESSION_ACTIONS } from '../session/session-actions';
import { DATA_PATH, ENTITLEMENT_PATH, QR_PATH } from './journey-paths';

/** Ruta del último paso alcanzado del recorrido. */
export const STEP_PATH: Record<Journey.StepEnum, string> = {
  identified: ENTITLEMENT_PATH,
  entitlement_confirmed: DATA_PATH,
  offer_obtained: QR_PATH,
};

/** Adónde va el titular según el recorrido: la ruta de su paso o, si ya no está en curso, Inicio. */
export function stepUrl(journey: Journey): string[] {
  return journey.state === 'in_progress' ? ['/', STEP_PATH[journey.step]] : ['/'];
}

export function isJourneyClosed(error: unknown): boolean {
  return error instanceof ApiProblemError && error.type === JOURNEY_CLOSED;
}

/** Lleva al titular al sitio que dice el servicio (prd.md §3.3, design.md §3.2). */
@Injectable({ providedIn: 'root' })
export class JourneyNavigator {
  private readonly router = inject(Router);
  private readonly journeyApi = inject(JourneyApi);
  private readonly session = inject(SESSION_ACTIONS);

  /**
   * El recorrido ha caducado: descarta los tokens (design.md §3.1, punto 7) y
   * devuelve la dirección de la sesión caducada. Es el único camino del 410,
   * venga de una llamada, de la guarda o del temporizador de inactividad.
   */
  expireSession(): string[] {
    this.session.discardTokens();
    return errorUrl('session-expired');
  }

  toSessionExpired(): Promise<boolean> {
    return this.router.navigate(this.expireSession());
  }

  /** Consulta `GET /journey` y va a la ruta de su paso; un 410 lleva a sesión caducada y otro fallo, a Inicio. */
  async toCurrentStep(): Promise<boolean> {
    try {
      const journey = await firstValueFrom(this.journeyApi.getJourney());
      return await this.router.navigate(stepUrl(journey));
    } catch (error: unknown) {
      return isJourneyClosed(error) ? this.toSessionExpired() : this.router.navigate(['/']);
    }
  }
}
