import { Component, computed, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IssuanceStartService } from '../issuance-start.service';

/** Tenant único servido por este portal (single-tenant CGCOM). */
const TENANT = 'cgcom';

/**
 * Pantalla informativa de arranque de emisión (AC-01, FR-01, FR-11).
 *
 * Dos estados, mutuamente excluyentes por construcción (`computed` sobre una
 * única fuente de verdad — `IssuanceStartService.cannotContinueReason`):
 * - **Informativo** (por defecto): información del proceso + CTA.
 * - **No se puede continuar** (AC-05): aviso genérico i18n + Reintentar
 *   (AC-06), sin exponer la causa cruda (ES-01).
 */
@Component({
  selector: 'app-issuance-info',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './issuance-info.component.html',
  styleUrl: './issuance-info.component.scss',
})
export class IssuanceInfoComponent {
  private readonly issuanceStartService = inject(IssuanceStartService);

  readonly cannotContinue = computed(() => this.issuanceStartService.cannotContinueReason() !== null);

  onStart(): void {
    this.issuanceStartService.start(TENANT);
  }

  onRetry(): void {
    this.issuanceStartService.retry();
  }
}
