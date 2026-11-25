import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { JourneyApi, JourneyRequest } from '../../core/api/generated/journey';
import { JourneyIssuanceStore } from '../../core/journey/journey-issuance.store';
import { JourneyNavigator, isJourneyClosed, isPending } from '../../core/journey/journey-navigator';
import { REQUESTS_PATH } from '../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
import { statusTextOf } from '../requests/requests.component';

/**
 * Final (wireframes, Final; prd.md FR-17; design.md §3.5, punto 5): las
 * atestaciones guardadas, las solicitudes con un problema y cuántas quedan
 * pendientes, con los datos de la misma llamada que Solicitudes. Volver a mis
 * solicitudes solo si queda alguna pendiente. Salir termina el recorrido con
 * `POST /journey/withdrawal`, descarta los tokens y va a Inicio. La ruta la
 * protege `journeyStepGuard` (recorrido activo).
 */
@Component({
  selector: 'app-done',
  imports: [TranslatePipe],
  templateUrl: './done.component.html',
})
export class DoneComponent implements OnInit {
  private readonly journeyApi = inject(JourneyApi);
  private readonly navigator = inject(JourneyNavigator);
  private readonly router = inject(Router);
  private readonly session = inject(SESSION_ACTIONS);
  private readonly store = inject(JourneyIssuanceStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly exiting = signal(false);
  private readonly requests = signal<JourneyRequest[]>([]);

  protected readonly saved = computed(() => this.requests().filter((request) => request.status === 'saved'));
  protected readonly problems = computed(() => this.requests().filter((request) => request.status === 'not_available'));
  protected readonly pending = computed(() => this.requests().filter(isPending).length);

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

  protected problemKey(request: JourneyRequest): string {
    return `requests.status.${statusTextOf(request)}`;
  }

  protected onBackToRequests(): void {
    void this.router.navigate(['/', REQUESTS_PATH]);
  }

  /**
   * «Salir»: termina el recorrido y descarta los tokens (design.md §3.1,
   * punto 7). Si la retirada falla, los tokens se descartan igual y el
   * recorrido caduca en el servicio. Con un 410, el interceptor ya lleva a la
   * sesión caducada.
   */
  protected onExit(): void {
    if (this.exiting()) {
      return;
    }
    this.exiting.set(true);
    this.journeyApi
      .withdrawJourney()
      .pipe(finalize(() => this.exiting.set(false)))
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
