import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { JourneyApi, JourneyRequest } from '../../core/api/generated/journey';
import { JourneyNavigator, isJourneyClosed } from '../../core/journey/journey-navigator';
import { DONE_PATH, dataUrl, qrUrl } from '../../core/journey/journey-paths';

/** Qué dice el estado de una solicitud (wireframes, Solicitudes; prd.md FR-14); cada uno tiene su texto en `requests.status.*`. */
export type RequestStatusText =
  | 'pending'
  | 'renewal'
  | 'inOffer'
  | 'saved'
  | 'notYours'
  | 'mismatch'
  | 'underReview'
  | 'notAvailable';

/** El estado de la solicitud en palabras: pendiente, renovación, guardada o el problema y qué hacer. */
export function statusTextOf(request: JourneyRequest): RequestStatusText {
  switch (request.status) {
    case 'available':
      return request.renewal ? 'renewal' : 'pending';
    case 'in_offer':
      return 'inOffer';
    case 'saved':
      return 'saved';
    case 'not_available':
      if (request.not_available_reason === 'identifier_mismatch') {
        return 'notYours';
      }
      if (request.not_available_reason === 'identity_mismatch') {
        return 'mismatch';
      }
      return request.not_available_reason === 'under_review' ? 'underReview' : 'notAvailable';
  }
}

/**
 * Solicitudes (wireframes, Solicitudes; design.md §3.5, puntos 1 a 3): vuelve
 * a pedir `GET /journey` cada vez que se entra, para mostrar el estado
 * actualizado de cada solicitud con lo que permite reconocerla (organización,
 * identificador, quién la pidió y cuándo) y su estado en palabras. Obtener
 * solo aparece en las disponibles, también en las de renovación, y lleva a
 * sus Datos. En una con oferta, que ya se ha confirmado, lleva a su QR. La
 * ruta la protege `journeyStepGuard`.
 */
@Component({
  selector: 'app-requests',
  imports: [TranslatePipe, DatePipe],
  templateUrl: './requests.component.html',
})
export class RequestsComponent implements OnInit {
  private readonly journeyApi = inject(JourneyApi);
  private readonly navigator = inject(JourneyNavigator);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly requests = signal<JourneyRequest[]>([]);
  protected readonly loading = signal(true);
  /** Nombre de la atestación, del primer `attestation.type_name` que traiga alguna solicitud; si ninguna lo trae, ninguno. */
  protected readonly typeName = computed(
    () => this.requests().find((request) => request.attestation?.type_name)?.attestation?.type_name ?? null,
  );

  ngOnInit(): void {
    this.journeyApi
      .getJourney()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (journey) => {
          this.requests.set(journey.requests ?? []);
          this.loading.set(false);
        },
        // GET /journey no pasa por el interceptor de 409 y 410 (EUD-287).
        error: (error: unknown) =>
          void (isJourneyClosed(error) ? this.navigator.toSessionExpired() : this.router.navigate(['/'])),
      });
  }

  protected statusText(request: JourneyRequest): RequestStatusText {
    return statusTextOf(request);
  }

  /** Con un problema: no está a su nombre, sus datos no coinciden, los ha puesto en revisión o no se puede obtener. */
  protected isProblem(request: JourneyRequest): boolean {
    return request.status === 'not_available';
  }

  /** Obtener solo en las disponibles; en las que ya tienen proceso, para seguir con su QR. */
  protected canGet(request: JourneyRequest): boolean {
    return request.status === 'available' || request.status === 'in_offer';
  }

  /** «Terminar»: va a Final. */
  protected onFinish(): void {
    void this.router.navigate(['/', DONE_PATH]);
  }

  protected onGet(request: JourneyRequest): void {
    void this.router.navigate(request.status === 'in_offer' ? qrUrl(request.id) : dataUrl(request.id));
  }
}
