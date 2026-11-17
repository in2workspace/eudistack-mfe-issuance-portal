import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiProblemError, JOURNEY_CLOSED } from '../api/api-problem.error';
import { Journey, JourneyApi, JourneyRequest } from '../api/generated/journey';
import { errorUrl } from '../../features/error/error-reason';
import { SESSION_ACTIONS } from '../session/session-actions';
import { JourneyIssuanceStore } from './journey-issuance.store';
import { EMAIL_PATH, ENTITLEMENT_PATH, REQUESTS_PATH, dataUrl, qrUrl } from './journey-paths';

/**
 * El correo del recorrido está verificado: se pueden ver las solicitudes y
 * pedir cualquier emisión (prd.md FR-13). Lo dice `email_verification`, no el
 * paso: el paso nunca retrocede (ac.md de EUD-358, decisión 2) y un código
 * nuevo deja el correo sin verificar con el paso en `email_verified`.
 */
export function isEmailVerified(journey: Journey): boolean {
  return journey.email_verification?.verified === true;
}

/** Las solicitudes del recorrido; ninguna hasta que Comprobación las obtiene. */
function requestsOf(journey: Journey): JourneyRequest[] {
  return journey.requests ?? [];
}

/** La solicitud `requestId` del recorrido, si es de él. */
export function requestOf(journey: Journey, requestId: string | null): JourneyRequest | undefined {
  return requestsOf(journey).find((request) => request.id === requestId);
}

/** El titular puede confirmarla: sus datos se ven y se piden (AD-8). */
export function isAvailable(request: JourneyRequest | undefined): boolean {
  return request?.status === 'available';
}

/**
 * Tiene una oferta que aún sirve. La caducidad que cuenta es la de la
 * dirección de alta si la hay y, si no, la de la oferta (design.md §3.3),
 * como en `resolveOfferAddress`.
 */
export function hasCurrentOffer(request: JourneyRequest, now: number = Date.now()): boolean {
  const offer = request.offer;
  if (request.status !== 'in_offer' || !offer) {
    return false;
  }
  const expiresAt = Date.parse(offer.onboarding_url ? (offer.onboarding_expires_at ?? '') : offer.expires_at);
  return expiresAt > now;
}

/**
 * Ruta que corresponde al recorrido (design.md AD-8): sin solicitudes
 * obtenidas, Comprobación; sin correo verificado, Correo; con él, el QR de una
 * solicitud con oferta vigente, los Datos de la única solicitud si es
 * disponible o, si no, Solicitudes.
 */
function screenUrl(journey: Journey): string[] {
  if (journey.step === 'identified') {
    return ['/', ENTITLEMENT_PATH];
  }
  if (!isEmailVerified(journey)) {
    return ['/', EMAIL_PATH];
  }
  const requests = requestsOf(journey);
  const withOffer = requests.find((request) => hasCurrentOffer(request));
  if (withOffer) {
    return qrUrl(withOffer.id);
  }
  if (requests.length === 1 && isAvailable(requests[0])) {
    return dataUrl(requests[0].id);
  }
  return ['/', REQUESTS_PATH];
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
  return isJourneyActive(journey) ? screenUrl(journey) : ['/'];
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
