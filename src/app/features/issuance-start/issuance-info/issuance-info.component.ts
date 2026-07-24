import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IssuanceStartService } from '../issuance-start.service';

/** Tenant único servido por este portal (single-tenant CGCOM). */
const TENANT = 'cgcom';

/** Email de soporte CGCOM, alineado con el usado en incidents.component y en la pantalla demo. */
const SUPPORT_EMAIL = 'soporte@cgcom-identidad.es';

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
  private readonly router = inject(Router);

  readonly cannotContinue = computed(() => this.issuanceStartService.cannotContinueReason() !== null);
  readonly currentYear = new Date().getFullYear();

  onStart(): void {
    this.issuanceStartService.start(TENANT);
  }

  onRetry(): void {
    this.issuanceStartService.retry();
  }

  navigateToIncidents(): void {
    this.router.navigate(['/portal/incidents']);
  }

  contactByEmail(): void {
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
  }
}
