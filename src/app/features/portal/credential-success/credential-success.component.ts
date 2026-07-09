import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { AuthenticatedUser } from '../../../core/models/issuance.model';

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

  readonly user = this.state.authenticatedUser() as AuthenticatedUser;

  readonly issueDate = new Date();
  readonly expiryDate = new Date(this.issueDate.getFullYear() + 2, this.issueDate.getMonth(), this.issueDate.getDate());
  readonly credentialId = `CGCOM-DOCTORID-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

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
