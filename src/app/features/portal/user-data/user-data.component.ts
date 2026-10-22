import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BrandingService } from '../../../core/branding/branding.service';

/**
 * Paso Datos. Ya no lee el usuario del navegador ni pinta etiquetas fijas por
 * tenant: la vista previa de la atestación la dará `GET /journey` (EUD-286).
 * Hasta entonces la ruta la protege `pendingJourneyGuard`.
 */
@Component({
  selector: 'app-user-data',
  imports: [],
  templateUrl: './user-data.component.html',
})
export class UserDataComponent {
  private readonly router = inject(Router);
  protected readonly branding = inject(BrandingService);

  onCancel(): void {
    this.router.navigate(['/']);
  }

  onContinue(): void {
    this.router.navigate(['/offer']);
  }
}
