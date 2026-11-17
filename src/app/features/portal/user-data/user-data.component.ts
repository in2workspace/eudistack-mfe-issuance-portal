import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { ApiProblemError, JOURNEY_CLOSED, REQUEST_NOT_AVAILABLE, REQUEST_NOT_FOUND, STEP_NOT_ALLOWED } from '../../../core/api/api-problem.error';
import { EntitlementApi } from '../../../core/api/generated/authentic-source';
import { AttestationPreview, Journey, JourneyApi } from '../../../core/api/generated/journey';
import { JourneyIssuanceStore } from '../../../core/journey/journey-issuance.store';
import { JourneyNavigator, isAvailable, isJourneyClosed, requestOf, stepUrl } from '../../../core/journey/journey-navigator';
import { REQUESTS_PATH, REQUEST_ID_PARAM, qrUrl } from '../../../core/journey/journey-paths';
import { HeaderBackService } from '../../../shared/components/portal-header/header-back.service';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Paso Datos de una solicitud (wireframes, Datos): la vista previa de la
 * atestación tal como la devuelve `GET /journey` para la solicitud de la ruta,
 * solo para leer, sin etiquetas fijas por tenant (prd.md FR-04). Son
 * correctos, continuar va a QR de esa solicitud, que pide la confirmación.
 * Cancelar pide confirmación y retira el recorrido. La ruta la protege
 * `journeyStepGuard`.
 */
@Component({
  selector: 'app-user-data',
  imports: [TranslatePipe, ConfirmDialogComponent],
  templateUrl: './user-data.component.html',
})
export class UserDataComponent implements OnInit {
  private readonly journeyApi = inject(JourneyApi);
  private readonly entitlementApi = inject(EntitlementApi);
  private readonly navigator = inject(JourneyNavigator);
  private readonly router = inject(Router);
  private readonly session = inject(SESSION_ACTIONS);
  private readonly store = inject(JourneyIssuanceStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly headerBack = inject(HeaderBackService);
  /** La solicitud de la ruta (design.md AD-9). */
  private readonly requestId = inject(ActivatedRoute).snapshot.paramMap.get(REQUEST_ID_PARAM) ?? '';

  protected readonly attestation = signal<AttestationPreview | null>(null);
  protected readonly loading = signal(true);
  protected readonly cancelOpen = signal(false);
  protected readonly withdrawing = signal(false);
  /** Continuar está yendo a QR: una segunda pulsación no navega otra vez (ac.md EC-07). */
  protected readonly continuing = signal(false);
  /** El journey tiene varias solicitudes: hay a dónde volver (wireframes, Datos). */
  protected readonly severalRequests = signal(false);
  /** Mis datos no son correctos: anotado (el aviso) o no se ha podido anotar (ES-03). */
  protected readonly disputed = signal(false);
  protected readonly disputeFailed = signal(false);
  protected readonly disputing = signal(false);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.headerBack.clear());
    this.journeyApi
      .getJourney()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (journey) => this.show(journey),
        // GET /journey no pasa por el interceptor de 409 y 410 (EUD-287).
        error: (error: unknown) =>
          void (isJourneyClosed(error) ? this.navigator.toSessionExpired() : this.router.navigate(['/'])),
      });
  }

  /** La guarda ya ha comprobado la solicitud: solo una carrera con otra pestaña la deja de tener disponible. */
  private show(journey: Journey): void {
    const request = requestOf(journey, this.requestId);
    if (!isAvailable(request)) {
      void this.router.navigate(stepUrl(journey), { replaceUrl: true });
      return;
    }
    // Wireframes: con varias solicitudes, el botón de volver lleva a Solicitudes; con una, no hay.
    if ((journey.requests ?? []).length > 1) {
      this.severalRequests.set(true);
      this.headerBack.set(() => void this.router.navigate(['/', REQUESTS_PATH]));
    }
    this.attestation.set(request?.attestation ?? null);
    this.loading.set(false);
  }

  protected onContinue(): void {
    if (this.continuing() || this.withdrawing()) {
      return;
    }
    this.continuing.set(true);
    // Si la guarda no deja pasar, el titular sigue en Datos y puede volver a intentarlo.
    void this.router.navigate(qrUrl(this.requestId)).finally(() => this.continuing.set(false));
  }

  /**
   * «Mis datos no son correctos» (design.md AD-11): sin confirmación previa,
   * avisa a Fuente auténtica con el identificador de la solicitud y sin datos
   * del titular. 204 abre el aviso; un fallo de red o un 5xx dice que no se ha
   * podido anotar y deja reintentar (ES-03); 404 y 409 llevan al paso que
   * diga el recorrido (ES-02).
   */
  protected onDispute(): void {
    if (this.disputing() || this.withdrawing()) {
      return;
    }
    this.disputing.set(true);
    this.disputeFailed.set(false);
    this.entitlementApi
      .disputeRequestData(this.requestId)
      .pipe(finalize(() => this.disputing.set(false)))
      .subscribe({
        next: () => this.disputed.set(true),
        error: (error: unknown) => this.onDisputeError(error),
      });
  }

  /** `step_not_allowed` y `journey_closed` los resuelve el interceptor de EUD-287. */
  private onDisputeError(error: unknown): void {
    const type = error instanceof ApiProblemError ? error.type : undefined;
    if (type === REQUEST_NOT_FOUND || type === REQUEST_NOT_AVAILABLE) {
      void this.navigator.toCurrentStep();
    } else if (type !== STEP_NOT_ALLOWED && type !== JOURNEY_CLOSED) {
      this.disputeFailed.set(true);
    }
  }

  /** «Volver a mis solicitudes». */
  protected onBackToRequests(): void {
    void this.router.navigate(['/', REQUESTS_PATH]);
  }

  /** «Salir» del aviso: termina el recorrido como Cancelar, sin pedir confirmación. */
  protected onExit(): void {
    this.onConfirmCancel();
  }

  protected onCancel(): void {
    this.cancelOpen.set(true);
  }

  protected onKeepGoing(): void {
    this.cancelOpen.set(false);
  }

  /**
   * «Sí, cancelar»: retira el recorrido y descarta los tokens (design.md
   * §3.1, punto 7). Si la retirada falla, los tokens se descartan igual y el
   * recorrido caduca en el servicio (ac.md ES-05). Con un 410, el interceptor
   * ya lleva a la sesión caducada.
   */
  protected onConfirmCancel(): void {
    if (this.withdrawing()) {
      return;
    }
    this.withdrawing.set(true);
    this.cancelOpen.set(false);
    this.journeyApi
      .withdrawJourney()
      .pipe(finalize(() => this.withdrawing.set(false)))
      .subscribe({
        next: () => this.leave(),
        error: (error: unknown) => (isJourneyClosed(error) ? this.store.clear() : this.leave()),
      });
  }

  private leave(): void {
    this.store.clear();
    this.session.discardTokens();
    void this.router.navigate(['/']);
  }
}
