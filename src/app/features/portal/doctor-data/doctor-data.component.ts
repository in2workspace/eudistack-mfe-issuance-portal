import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { IssuerService } from '../../../core/services/issuer.service';
import { AuthenticatedUser } from '../../../core/models/issuance.model';
import { CommonModule } from '@angular/common';

/**
 * Muestra los datos del médico autenticado y solicita confirmación antes del bootstrap.
 * Equivalente a DoctorDataPage.tsx (React).
 */
@Component({
  selector: 'app-doctor-data',
  imports: [CommonModule],
  templateUrl: './doctor-data.component.html',
})
export class DoctorDataComponent implements OnInit {
  private state = inject(IssuanceStateService);
  private issuer = inject(IssuerService);
  private router = inject(Router);

  user!: AuthenticatedUser;

  readonly isLoading = this.state.bootstrapLoading;
  readonly error = this.state.bootstrapError;

  readonly fields = () => [
    { label: 'Nombre completo',     value: this.user.name },
    { label: 'Número de colegiado', value: this.user.collegiateNumber },
    { label: 'DNI',                 value: this.user.dni },
    { label: 'Colegio Provincial',  value: this.user.college },
    { label: 'Especialidad',        value: this.user.specialty },
  ];

  ngOnInit(): void {
    const u = this.state.authenticatedUser();
    if (!u) {
      this.router.navigate(['/portal']);
      return;
    }
    this.user = u;
  }

  onCancel(): void {
    this.state.clearUser();
    this.router.navigate(['/portal']);
  }

  onContinue(): void {
    this.state.setBootstrapLoading(true);
    this.state.setBootstrapError(null);

    this.issuer.bootstrap(this.user).subscribe((result) => {
      this.state.setBootstrapLoading(false);
      if (result.success) {
        this.state.setCredentialOfferUrl(result.credentialOfferUrl);
        this.router.navigate(['/portal/qr']);
      } else {
        this.state.setBootstrapError(result.error);
      }
    });
  }
}
