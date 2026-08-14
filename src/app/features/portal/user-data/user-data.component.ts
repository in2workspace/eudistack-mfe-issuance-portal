import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { navigateBackToOrigin } from '../../../core/config/issuance-return';
import { AuthenticatedUser } from '../../../core/models/issuance.model';
import { IssuanceEntryPointService } from '../../issuance-entry-point/issuance-entry-point.service';
import { CommonModule } from '@angular/common';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';
import { IdentificationReturnService } from '../../identification/identification-return.service';

/** Copy de esta pantalla por perfil profesional — CGCOM emite para médicos colegiados; el resto de tenants, para empleados. */
interface UserDataCopy {
  title: string;
  sectionTitle: string;
  infoText: string;
  fields: Array<{ label: string; value: (user: AuthenticatedUser) => string }>;
}

const DOCTOR_COPY: UserDataCopy = {
  title: 'Datos del Médico',
  sectionTitle: 'Datos obtenidos del sistema CGCOM',
  infoText:
    'Estos datos han sido obtenidos del sistema de información de CGCOM. Si detectas algún error, contacta con tu Colegio Provincial.',
  fields: [
    { label: 'Nombre completo', value: (u) => u.name },
    { label: 'Número de colegiado', value: (u) => u.collegiateNumber },
    { label: 'DNI', value: (u) => u.dni },
    { label: 'Colegio Provincial', value: (u) => u.college },
    { label: 'Especialidad', value: (u) => u.specialty },
  ],
};

const EMPLOYEE_COPY: UserDataCopy = {
  title: 'Datos del Empleado',
  sectionTitle: 'Datos obtenidos del sistema corporativo',
  infoText:
    'Estos datos han sido obtenidos del sistema de información corporativo. Si detectas algún error, contacta con Recursos Humanos.',
  fields: [
    { label: 'Nombre completo', value: (u) => u.name },
    { label: 'Número de empleado', value: (u) => u.collegiateNumber },
    { label: 'DNI', value: (u) => u.dni },
    { label: 'Empresa', value: (u) => u.college },
    { label: 'Puesto', value: (u) => u.specialty },
  ],
};

@Component({
  selector: 'app-user-data',
  imports: [CommonModule],
  templateUrl: './user-data.component.html',
})
export class UserDataComponent implements OnInit {
  private state = inject(IssuanceStateService);
  private router = inject(Router);
  private entryPoint = inject(IssuanceEntryPointService);
  private identificationReturn = inject(IdentificationReturnService);
  protected readonly branding = inject(BrandingService);

  user!: AuthenticatedUser;

  /** Único tenant con emisión DoctorID hoy; el resto ve el copy genérico de empleado (R-5/AD-2, mismo criterio que EUD-166). */
  protected readonly copy: UserDataCopy =
    resolveTenantIdentity(window.location, environment) === 'cgcom' ? DOCTOR_COPY : EMPLOYEE_COPY;

  readonly fields = () => this.copy.fields.map((f) => ({ label: f.label, value: f.value(this.user) }));

  ngOnInit(): void {
    const u = this.state.authenticatedUser();
    if (!u) {
      this.router.navigate(['/']);
      return;
    }
    this.user = u;

    // EUD-164 (AD-4/AD-7, §3.3.1): traduce el tri-estado interno al
    // `correlated: boolean` real que EUD-165 ya consume. `out_of_scope`
    // (los 4 métodos fuera de alcance de esta Story) cuenta como `true` —
    // solo `rejected` cierra la frontera en `false` (AC-08).
    void this.entryPoint.start({
      correlated: this.identificationReturn.outcome() !== 'rejected',
      session: this.identificationReturn.session(),
    });
  }

  onCancel(): void {
    this.state.clearUser();
    navigateBackToOrigin(this.router, '/');
  }

  /**
   * EUD-163 (AD-1): ya no llama a `IssuerService.bootstrap()` ni fija
   * estado global — la obtención de la oferta vive en `CredentialOfferService`,
   * invocada desde la propia pantalla `/offer`.
   */
  onContinue(): void {
    this.router.navigate(['/offer']);
  }
}
