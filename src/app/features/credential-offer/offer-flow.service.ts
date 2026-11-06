import { DestroyRef, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import {
  ApiProblemError,
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  ISSUANCE_REJECTED,
  ISSUANCE_UNAVAILABLE,
  NETWORK_ERROR,
  OFFER_NOT_RENEWABLE,
  ONBOARDING_UNAVAILABLE,
  STEP_NOT_ALLOWED,
  UNEXPECTED_ERROR,
} from '../../core/api/api-problem.error';
import { JourneyApi, Offer } from '../../core/api/generated/journey';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { JourneyIssuanceStore, OfferCall } from '../../core/journey/journey-issuance.store';
import { JourneyNavigator, isJourneyClosed, stepUrl } from '../../core/journey/journey-navigator';
import { DATA_PATH, QR_PATH } from '../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
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

/**
 * Pide la oferta al servicio y la presenta en QR (EUD-286, ac.md AC-08,
 * EC-02 a EC-04, ES-01 a ES-04). Qué llamada hacer lo dice
 * `JourneyIssuanceStore`: la confirmación con el correo al llegar de Datos, o
 * un código nuevo tras caducar el QR, y, tras un fallo, la misma que falló.
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
  private readonly session = inject(SESSION_ACTIONS);
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  /** QR (generando) al entrar: hace la llamada pendiente o retoma lo que dice el servicio. */
  async enter(): Promise<void> {
    this.presenter.startLoading();
    const pending = this.store.pendingCall();
    if (pending) {
      return this.request(pending);
    }
    const journey = await this.readJourney();
    if (journey === undefined || this.destroyed) {
      return;
    }
    if (journey.offer) {
      // Recarga con la oferta ya obtenida: se presenta la que tiene el servicio (EC-02).
      this.present(journey.offer);
    } else if (this.store.email()) {
      return this.request('confirmation');
    } else {
      // Sin el correo, que solo vive en memoria, no se puede confirmar: vuelta a Datos (EC-03).
      void this.router.navigate(['/', DATA_PATH], { replaceUrl: true });
    }
  }

  /** «Generar un código nuevo» con el QR caducado (AC-06). */
  newCode(): Promise<void> {
    this.store.requestNewOffer();
    this.presenter.startLoading();
    return this.request('offers');
  }

  /**
   * «He terminado» (ac.md AC-15): termina el recorrido y descarta los tokens
   * (design.md §3.1, punto 7). Si la retirada falla, los tokens se descartan
   * igual (ES-05). Con un 410, el interceptor ya lleva a la sesión caducada.
   */
  async finish(): Promise<void> {
    this.presenter.cancelPendingWork();
    try {
      await firstValueFrom(this.journeyApi.withdrawJourney());
    } catch (error: unknown) {
      if (isJourneyClosed(error)) {
        this.store.clear();
        return;
      }
    }
    this.store.clear();
    this.session.discardTokens();
    void this.router.navigate(['/']);
  }

  private async request(call: OfferCall): Promise<void> {
    try {
      const offer = await firstValueFrom(this.call(call));
      if (this.destroyed) {
        return;
      }
      this.store.offerReceived();
      this.present(offer);
    } catch (error: unknown) {
      if (!this.destroyed) {
        await this.onFailure(call, error);
      }
    }
  }

  private call(call: OfferCall): Observable<Offer> {
    return call === 'confirmation'
      ? this.journeyApi.confirmAndIssue({ email: this.store.email() ?? undefined })
      : this.journeyApi.newOffer();
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
  private async onFailure(call: OfferCall, error: unknown): Promise<void> {
    if (!(error instanceof ApiProblemError)) {
      return;
    }
    const reason = ISSUANCE_FAILURES[error.type];
    if (reason) {
      void this.router.navigate(errorUrl(reason));
    } else if (error.type === OFFER_NOT_RENEWABLE) {
      // El recorrido ha terminado en el servicio; la pantalla de error descarta los tokens.
      this.store.clear();
      void this.router.navigate(errorUrl('offer-not-renewable'));
    } else if (error.type === EMAIL_REQUIRED || error.type === EMAIL_INVALID) {
      this.store.rejectEmail();
      void this.router.navigate(['/', DATA_PATH]);
    } else if (error.type === STEP_NOT_ALLOWED) {
      // El servicio ya tiene una oferta vigente (desfase de reloj en un código
      // nuevo, o una confirmación repetida con atrás y adelante): se presenta (ES-02).
      await this.presentCurrentOffer();
    }
  }

  /**
   * Sin oferta, el interceptor de EUD-287 lleva a la ruta del paso. Si esa
   * ruta es la propia QR, el router no navega y la pantalla se quedaría en
   * «generando»: se va al caso de emisión, que deja reintentar (review W2).
   */
  private async presentCurrentOffer(): Promise<void> {
    const journey = await this.readJourney();
    if (!journey || this.destroyed) {
      return;
    }
    if (journey.offer) {
      this.store.offerReceived();
      this.present(journey.offer);
    } else if (stepUrl(journey).at(-1) === QR_PATH) {
      void this.router.navigate(errorUrl('issuance-failed'));
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
