import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Request as SourceRequest } from '../../core/api/generated/authentic-source';
import { EntitlementOutcomeStore } from '../../core/journey/entitlement-outcome.store';

/**
 * Tus datos no coinciden (wireframes, Tus datos no coinciden; prd.md FR-18):
 * la única solicitud del titular no está disponible, o ninguna de varias lo está
 * (entonces lista cada una con su problema y qué hacer). Con `identifier_mismatch`
 * dice que no está a su nombre y a quién pedir que la revise; si no, qué datos
 * no coinciden con su certificado (`mismatched_fields`, si la fuente los da) y
 * que debe actualizarlos en su origen. El contrato no da los valores de cada
 * dato, solo su nombre. El recorrido ya está retirado y los tokens
 * descartados por Comprobación. Solo se muestra con lo que Comprobación dejó
 * en memoria (`heldOutcomeGuard`).
 */
@Component({
  selector: 'app-request-unavailable',
  imports: [TranslatePipe],
  templateUrl: './request-unavailable.component.html',
})
export class RequestUnavailableComponent {
  private readonly router = inject(Router);
  private readonly outcome = inject(EntitlementOutcomeStore);

  protected readonly requests = computed(() => {
    const outcome = this.outcome.outcome();
    return outcome?.kind === 'request-unavailable' ? outcome.requests : [];
  });

  /** Una sola solicitud: la pantalla explica ese caso. Varias: lista cada una con su problema. */
  protected readonly several = computed(() => this.requests().length > 1);

  private readonly request = computed(() => this.requests()[0] ?? null);

  /** No está a su nombre: su identificador no le corresponde en la fuente. */
  protected readonly notYours = computed(() => this.request()?.status === 'identifier_mismatch');

  /** Los datos que no coinciden, que la fuente da o no. */
  protected readonly fields = computed(() => this.request()?.mismatched_fields ?? []);

  /** Qué dice el estado de una solicitud de la lista, con las claves de Solicitudes. */
  protected problemKey(request: SourceRequest): string {
    return `requests.status.${request.status === 'identifier_mismatch' ? 'notYours' : request.status === 'under_review' ? 'underReview' : 'mismatch'}`;
  }

  /** «Salir»: olvida lo que había en memoria y va a Inicio. */
  protected onExit(): void {
    this.outcome.clear();
    void this.router.navigate(['/']);
  }
}
