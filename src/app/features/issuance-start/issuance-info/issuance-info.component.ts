import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { resolveSupportEmail } from '../../../core/branding/resolve-support-email';

/**
 * Pantalla informativa de arranque de emisión (AC-01, FR-01, FR-11): qué es
 * la cartera, cómo funciona el proceso y el CTA para empezar.
 */
@Component({
  selector: 'app-issuance-info',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './issuance-info.component.html',
  styleUrl: './issuance-info.component.scss',
})
export class IssuanceInfoComponent {
  private readonly router = inject(Router);

  readonly currentYear = new Date().getFullYear();
  protected readonly supportEmail = resolveSupportEmail();

  /**
   * El titular ya no se identifica en el portal: "Empezar" lo llevará al
   * inicio de sesión del Verifier, que añade EUD-314. Hasta entonces no hace
   * nada.
   */
  onStart(): void {
    // Sin destino hasta EUD-314.
  }

  navigateToIncidents(): void {
    this.router.navigate(['/incidents']);
  }

  contactByEmail(): void {
    window.location.href = `mailto:${this.supportEmail}`;
  }
}
