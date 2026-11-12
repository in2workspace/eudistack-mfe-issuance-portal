import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiProblemError, JOURNEY_CLOSED } from '../api/api-problem.error';
import { Journey, JourneyApi } from '../api/generated/journey';
import { errorUrl } from '../../features/error/error-reason';
import { SESSION_ACTIONS } from '../session/session-actions';
import { JourneyIssuanceStore } from './journey-issuance.store';
import { DATA_PATH, EMAIL_PATH, ENTITLEMENT_PATH, QR_PATH } from './journey-paths';

/**
 * El derecho está confirmado y la oferta aún no se ha obtenido: el titular
 * está en Datos, Verificar correo o QR (generando). El paso nunca retrocede
 * (ac.md de EUD-358, decisión 2): tras la primera verificación sigue en
 * `email_verified` aunque pida un código nuevo, así que lo que decide la
 * pantalla es `email_verification`, no el paso.
 */
export function hasConfirmedEntitlement(journey: Journey): boolean {
  return journey.step === 'entitlement_confirmed' || journey.step === 'email_verified';
}

/** Hay un código pendiente de comprobar: Verificar correo. */
export function hasPendingEmailCode(journey: Journey): boolean {
  return hasConfirmedEntitlement(journey) && journey.email_verification?.verified === false;
}

/** El correo está verificado y falta la oferta: QR (generando) confirma. */
export function hasVerifiedEmail(journey: Journey): boolean {
  return hasConfirmedEntitlement(journey) && journey.email_verification?.verified === true;
}

/** Ruta que corresponde al recorrido (prd.md §3.3, design.md §3.4, punto 5). */
function screenPath(journey: Journey): string {
  if (journey.step === 'identified') {
    return ENTITLEMENT_PATH;
  }
  if (journey.step === 'offer_obtained' || hasVerifiedEmail(journey)) {
    return QR_PATH;
  }
  return hasPendingEmailCode(journey) ? EMAIL_PATH : DATA_PATH;
}

/**
 * Recorrido en el que el titular sigue teniendo un paso: en curso o, tras la
 * primera oferta, `completed` con `offer_obtained`. El servicio pasa el
 * recorrido a `completed` al entregar la primera oferta, pero el titular sigue
 * en QR y puede pedir un código nuevo (EUD-286, decisión 6 de ac.md).
 */
export function isJourneyActive(journey: Journey): boolean {
  return journey.state === 'in_progress' || (journey.state === 'completed' && journey.step === 'offer_obtained');
}

/** Adónde va el titular según el recorrido: la ruta de su paso o, si ya no tiene paso, Inicio. */
export function stepUrl(journey: Journey): string[] {
  return isJourneyActive(journey) ? ['/', screenPath(journey)] : ['/'];
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
  private readonly issuance = inject(JourneyIssuanceStore);

  /**
   * El recorrido ha caducado: descarta los tokens (design.md §3.1, punto 7) y
   * la llamada pendiente de la oferta, y devuelve la dirección de la sesión
   * caducada. Es el único camino del 410, venga de una llamada, de la
   * guarda o del temporizador de inactividad.
   */
  expireSession(): string[] {
    this.issuance.clear();
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
