import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { AuthenticatedUser } from '../../../core/models/issuance.model';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';

/** Único tenant con emisión DoctorID hoy; el resto emite una credencial genérica de empleado (mismo criterio que UserDataComponent/CredentialQrComponent). */
function resolveCredentialLabel(): string {
  return resolveTenantIdentity(window.location, environment) === 'cgcom' ? 'DoctorID' : 'EmployeeID';
}

/**
 * Pantalla de éxito tras la emisión de la credencial.
 * Equivalente a CredentialSuccessPage.tsx (React).
 */
@Component({
  selector: 'app-credential-success',
  imports: [CommonModule],
  templateUrl: './credential-success.component.html',
})
export class CredentialSuccessComponent {
  private state = inject(IssuanceStateService);
  private router = inject(Router);
  protected readonly branding = inject(BrandingService);

  readonly user = this.state.authenticatedUser() as AuthenticatedUser;

  protected readonly credentialLabel = resolveCredentialLabel();
  protected readonly isDoctorTenant = this.credentialLabel === 'DoctorID';

  readonly issueDate = new Date();
  readonly expiryDate = new Date(this.issueDate.getFullYear() + 2, this.issueDate.getMonth(), this.issueDate.getDate());
  readonly credentialId = `${this.credentialLabel.toUpperCase()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

  issueDateStr(): string {
    return this.issueDate.toLocaleDateString('es-ES');
  }

  expiryDateStr(): string {
    return this.expiryDate.toLocaleDateString('es-ES');
  }

  onContinue(): void {
    this.router.navigate(['/portal/home']);
  }
}
