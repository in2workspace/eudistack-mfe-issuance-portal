import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { hasSupportDetails } from '../../core/config/support-details';
import { EntitlementOutcomeStore } from '../../core/journey/entitlement-outcome.store';

/**
 * Sin solicitudes (wireframes, Sin solicitudes; prd.md FR-18): el titular
 * consta en la fuente sin ninguna solicitud. Dice que todavía no tiene
 * ninguna y a quién pedirla, con el soporte del tenant. El recorrido ya está
 * retirado y los tokens descartados por Comprobación. Solo se muestra con lo
 * que Comprobación dejó en memoria (`heldOutcomeGuard`).
 */
@Component({
  selector: 'app-no-requests',
  imports: [TranslatePipe],
  templateUrl: './no-requests.component.html',
})
export class NoRequestsComponent {
  private readonly router = inject(Router);
  private readonly outcome = inject(EntitlementOutcomeStore);
  private readonly portalConfig = inject(PortalConfigService);

  protected readonly support = computed(() => {
    const support = this.portalConfig.config()?.support;
    return hasSupportDetails(support) ? support : null;
  });

  /** «Volver al inicio»: olvida lo que había en memoria y va a Inicio. */
  protected onHome(): void {
    this.outcome.clear();
    void this.router.navigate(['/']);
  }
}
