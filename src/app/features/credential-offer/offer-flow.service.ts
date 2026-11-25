import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import {
  ApiProblemError,
  ISSUANCE_REJECTED,
  ISSUANCE_UNAVAILABLE,
  JOURNEY_CLOSED,
  NETWORK_ERROR,
  REQUEST_SAVED,
  ONBOARDING_UNAVAILABLE,
  STEP_NOT_ALLOWED,
  UNEXPECTED_ERROR,
} from '../../core/api/api-problem.error';
import { JourneyApi, Offer } from '../../core/api/generated/journey';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { JourneyIssuanceStore, OfferCall } from '../../core/journey/journey-issuance.store';
import {
  JourneyNavigator,
  isAvailable,
  hasPendingRequests,
  isEmailVerified,
  isJourneyClosed,
  requestOf,
  stepUrl,
} from '../../core/journey/journey-navigator';
import { DONE_PATH, REQUESTS_PATH } from '../../core/journey/journey-paths';
import { ErrorReason, errorUrl } from '../error/error-reason';
import { CredentialOfferService } from './credential-offer.service';
import { resolveOfferAddress } from './resolve-offer-address';

/**
 * Fallos de emisión con los que la pantalla de error deja repetir la misma
 * llamada (design.md §3.2). Además de los del contrato, la orden no dice qué
 * hacer sin respuesta o con un error sin Problem: se tratan como emisión no
 * disponible, que deja reintentar.
 */
const ISSUANCE_FAILURES: Readonly<Record<string, ErrorReason>> = {
  [ISSUANCE_REJECTED]: 'issuance-failed',
  [ISSUANCE_UNAVAILABLE]: 'issuance-failed',
  [NETWORK_ERROR]: 'issuance-failed',
  [UNEXPECTED_ERROR]: 'issuance-failed',
  [ONBOARDING_UNAVAILABLE]: 'onboarding-unavailable',
};

/** Qué pasó al declarar guardada una solicitud: siguió, lo resolvió el interceptor de EUD-287, o falló y se puede repetir. */
export type SaveResult = 'saved' | 'handled' | 'failed';

/**
 * Pide la oferta de una solicitud al servicio y la presenta en QR (EUD-286,
 * ac.md AC-08, EC-02 a EC-04, ES-01 a ES-04). La confirmación y el código
 * nuevo solo llevan el identificador de la solicitud (EUD-359): el correo y los
 * datos son los que el servicio ya tiene. Qué llamada hacer lo dice
 * `JourneyIssuanceStore` o, sin llamada pendiente, `GET /journey`: la
 * confirmación de una solicitud disponible, un código nuevo tras caducar el QR
 * y, tras un fallo, la misma que falló.
 * Se provee en la pantalla QR: si el titular ya ha salido, no navega ni
 * presenta nada.
 */
@Injectable()
export class OfferFlowService {
  private readonly journeyApi = inject(JourneyApi);
  private readonly config = inject(PortalConfigService);
  private readonly store = inject(JourneyIssuanceStore);
  private readonly presenter = inject(CredentialOfferService);
  private readonly navigator = inject(JourneyNavigator);
  private readonly router = inject(Router);
  private destroyed = false;
  private readonly _typeName = signal<string | null>(null);

  /** Nombre de la atestación de la solicitud, para el título del QR; `null` mientras no se sabe. */
  readonly typeName = this._typeName.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  /** QR (generando) de la solicitud al entrar: hace la llamada pendiente o retoma lo que dice el servicio. */
  async enter(requestId: string): Promise<void> {
    this.presenter.startLoading();
    const pending = this.store.pending();
    if (pending?.requestId === requestId) {
      this._typeName.set(pending.typeName ?? null);
      return this.request(pending.call, requestId);
    }
    const journey = await this.readJourney();
    if (journey === undefined || this.destroyed) {
      return;
    }
    const request = requestOf(journey, requestId);
    this._typeName.set(request?.attestation?.type_name ?? null);
    if (request?.offer) {
      // Recarga con la oferta ya obtenida: se presenta la que tiene el servicio (EC-02).
      this.present(request.offer);
    } else if (isAvailable(request) && isEmailVerified(journey)) {
      this.store.requestConfirmation(requestId, this._typeName());
      return this.request('confirmation', requestId);
    } else if (request?.status === 'in_offer') {
      // La solicitud tiene proceso pero no oferta (el alta falló): una oferta nueva del mismo proceso.
      this.store.requestNewOffer(requestId, this._typeName());
      return this.request('offers', requestId);
    } else {
      // Sin el correo verificado o con otro estado no se puede confirmar (AC-09, EC-07): al paso que toca.
      // Nunca es el QR de esta solicitud: con una oferta vigente se habría presentado arriba.
      void this.router.navigate(stepUrl(journey), { replaceUrl: true });
    }
  }

  /**
   * «Generar un código nuevo» con el QR caducado (AC-06). Solo con el QR
   * caducado: una segunda pulsación, ya generando, no pide otro (EC-07).
   */
  async newCode(requestId: string): Promise<void> {
    if (this.presenter.status() !== 'expired') {
      return;
    }
    this.store.requestNewOffer(requestId, this._typeName());
    this.presenter.startLoading();
    return this.request('offers', requestId);
  }

  /**
   * «Ya lo he guardado» (design.md AD-10, §3.3 punto 6): declara guardada la
   * solicitud y sigue: a Solicitudes si queda alguna pendiente, o a Final si
   * no. El portal no comprueba que la cartera la haya guardado. Con 409
   * `step_not_allowed` y con 410 el interceptor de EUD-287 lleva al paso o a
   * la sesión caducada. Otro fallo (red, 5xx) deja al titular en QR con el
   * aviso de que no se ha podido anotar, y puede volver a pulsarlo.
   */
  async declareSaved(requestId: string): Promise<SaveResult> {
    try {
      await firstValueFrom(this.journeyApi.declareRequestSaved(requestId));
    } catch (error: unknown) {
      const type = error instanceof ApiProblemError ? error.type : undefined;
      return type === STEP_NOT_ALLOWED || type === JOURNEY_CLOSED ? 'handled' : 'failed';
    }
    if (this.destroyed) {
      return 'saved';
    }
    this.store.clear();
    const journey = await this.readJourney();
    if (journey === undefined || this.destroyed) {
      return 'saved';
    }
    this.presenter.reset();
    void this.router.navigate(['/', hasPendingRequests(journey) ? REQUESTS_PATH : DONE_PATH]);
    return 'saved';
  }

  private async request(call: OfferCall, requestId: string): Promise<void> {
    try {
      const offer = await firstValueFrom(this.call(call, requestId));
      if (this.destroyed) {
        return;
      }
      this.store.offerReceived();
      this.present(offer);
    } catch (error: unknown) {
      if (!this.destroyed) {
        await this.onFailure(requestId, error);
      }
    }
  }

  private call(call: OfferCall, requestId: string): Observable<Offer> {
    const reference = { request_id: requestId };
    return call === 'confirmation' ? this.journeyApi.confirmAndIssue(reference) : this.journeyApi.newOffer(reference);
  }

  /** Sin una dirección que funcione no hay QR: error de emisión (ES-03). */
  private present(offer: Offer): void {
    const address = resolveOfferAddress(offer, this.config.config()?.wallet_url);
    if (address) {
      this.presenter.present(address);
    } else {
      void this.router.navigate(errorUrl('issuance-failed'));
    }
  }

  /**
   * La llamada pendiente se conserva para que la pantalla de error la repita
   * (EC-04). `journey_closed` y `step_not_allowed` los resuelve el
   * interceptor de EUD-287, salvo cuando su destino es la propia QR
   * (`presentCurrentOffer`), y el 401, EUD-314.
   */
  private async onFailure(requestId: string, error: unknown): Promise<void> {
    if (!(error instanceof ApiProblemError)) {
      return;
    }
    const reason = ISSUANCE_FAILURES[error.type];
    if (reason) {
      void this.router.navigate(errorUrl(reason));
    } else if (error.type === REQUEST_SAVED) {
      // La solicitud ya está guardada en la cartera: el servicio la da por guardada y el recorrido sigue,
      // así que los tokens no se descartan (design.md §3.2; ac.md, decisión 5).
      this.store.clear();
      void this.router.navigate(errorUrl('request-saved'));
    } else if (error.type === STEP_NOT_ALLOWED) {
      // El servicio ya tiene una oferta vigente (desfase de reloj en un código
      // nuevo, o una confirmación repetida con atrás y adelante): se presenta (ES-02).
      await this.presentCurrentOffer(requestId);
    }
  }

  /**
   * Sin oferta, el interceptor de EUD-287 lleva a la ruta del paso.
   */
  private async presentCurrentOffer(requestId: string): Promise<void> {
    const journey = await this.readJourney();
    if (!journey || this.destroyed) {
      return;
    }
    const offer = requestOf(journey, requestId)?.offer;
    if (offer) {
      this.store.offerReceived();
      this.present(offer);
    }
  }

  /** `GET /journey` no pasa por el interceptor de 409 y 410: un 410 lleva a la sesión caducada y otro fallo, a Inicio. */
  private async readJourney() {
    try {
      return await firstValueFrom(this.journeyApi.getJourney());
    } catch (error: unknown) {
      if (!this.destroyed) {
        void (isJourneyClosed(error) ? this.navigator.toSessionExpired() : this.router.navigate(['/']));
      }
      return undefined;
    }
  }
}
