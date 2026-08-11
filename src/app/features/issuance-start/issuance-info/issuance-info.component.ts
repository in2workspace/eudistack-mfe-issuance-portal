import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IssuanceStartService } from '../issuance-start.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { resolveSupportEmail } from '../../../core/branding/resolve-support-email';
import { environment } from '../../../../environments/environment';

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
  protected readonly branding = inject(BrandingService);

  readonly cannotContinue = computed(() => this.issuanceStartService.cannotContinueReason() !== null);
  readonly currentYear = new Date().getFullYear();
  protected readonly supportEmail = resolveSupportEmail();

  onStart(): void {
    const tenant = resolveTenantIdentity(window.location, environment) ?? 'cgcom';
    this.issuanceStartService.start(tenant);
  }

  onRetry(): void {
    this.issuanceStartService.retry();
  }

  navigateToIncidents(): void {
    this.router.navigate(['/incidents']);
  }

  contactByEmail(): void {
    window.location.href = `mailto:${this.supportEmail}`;
  }
}
