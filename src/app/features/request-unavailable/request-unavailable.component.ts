import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EntitlementOutcomeStore } from '../../core/journey/entitlement-outcome.store';

/**
 * Tus datos no coinciden (wireframes, Tus datos no coinciden; prd.md FR-18):
 * la única solicitud del titular no está disponible. Con `identifier_mismatch`
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

  private readonly request = computed(() => {
    const outcome = this.outcome.outcome();
    return outcome?.kind === 'request-unavailable' ? outcome.request : null;
  });

  /** No está a su nombre: su identificador no le corresponde en la fuente. */
  protected readonly notYours = computed(() => this.request()?.status === 'identifier_mismatch');

  /** Los datos que no coinciden, que la fuente da o no. */
  protected readonly fields = computed(() => this.request()?.mismatched_fields ?? []);

  /** «Salir»: olvida lo que había en memoria y va a Inicio. */
  protected onExit(): void {
    this.outcome.clear();
    void this.router.navigate(['/']);
  }
}
