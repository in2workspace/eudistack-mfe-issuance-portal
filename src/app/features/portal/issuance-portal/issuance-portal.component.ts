import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { CredentialQrCodeComponent } from '../../../shared/components/credential-qr-code/credential-qr-code.component';
import { AuthenticatedUser, CredentialTemplate, IssuedCredential } from '../../../core/models/issuance.model';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';

type IssuanceStep = 'list' | 'confirm' | 'qr' | 'success';

/** Único tenant con emisión DoctorID hoy; el resto emite/gestiona una credencial genérica de empleado. */
function resolveIsDoctorTenant(): boolean {
  return resolveTenantIdentity(window.location, environment) === 'cgcom';
}

/**
 * Portal de credenciales con máquina de estados interna (list → confirm → qr → success).
 * Equivalente a IssuancePortal.tsx (React).
 * El icono se almacena como string para lucide-angular; aquí usamos SVG inline equivalente.
 */
@Component({
  selector: 'app-issuance-portal',
  imports: [CommonModule, CredentialQrCodeComponent],
  templateUrl: './issuance-portal.component.html',
})
export class IssuancePortalComponent implements OnInit {
  private state = inject(IssuanceStateService);
  private router = inject(Router);
  protected readonly branding = inject(BrandingService);

  protected readonly isDoctorTenant = resolveIsDoctorTenant();

  user!: AuthenticatedUser;

  readonly issuanceStep = signal<IssuanceStep>('list');
  readonly selectedCredential = signal<CredentialTemplate | null>(null);

  issuedCredentials = signal<IssuedCredential[]>(
    this.isDoctorTenant
      ? [
          {
            id: 'issued-1',
            templateId: 'doctor-id',
            name: 'Credencial de Identificación Médica (DoctorID)',
            issueDate: '2024-01-15',
            expiryDate: '2026-01-15',
            status: 'active',
            credentialId: 'DOCTORID-12345-2024',
          },
        ]
      : [
          {
            id: 'issued-1',
            templateId: 'employee-id',
            name: 'Credencial de Identificación de Empleado (EmployeeID)',
            issueDate: '2024-01-15',
            expiryDate: '2026-01-15',
            status: 'active',
            credentialId: 'EMPLOYEEID-12345-2024',
          },
        ],
  );

  availableCredentials: CredentialTemplate[] = [];

  // Datos de éxito generados una sola vez al entrar en el paso 'success'
  successCredentialId = '';
  successIssueDate = '';
  successExpiryDate = '';

  ngOnInit(): void {
    const u = this.state.authenticatedUser();
    if (!u) {
      this.router.navigate(['/portal']);
      return;
    }
    this.user = u;
    this.availableCredentials = this.isDoctorTenant
      ? [
          {
            id: 'doctor-id',
            name: 'Credencial de Identificación Médica (DoctorID)',
            description: 'Credencial principal que te identifica como médico colegiado en España',
            issuer: 'CGCOM',
            type: 'DoctorID',
            status: 'available',
            validityYears: 2,
            attributes: [
              { key: 'Nombre completo',     value: u.name },
              { key: 'Número de colegiado', value: u.collegiateNumber },
              { key: 'DNI',                 value: u.dni },
              { key: 'Colegio Provincial',  value: u.college },
              { key: 'Especialidad',        value: u.specialty },
            ],
            icon: 'shield',
            color: '#E67E22',
          },
          {
            id: 'ecip',
            name: 'Tarjeta Profesional Europea (eCIP)',
            description: 'Credencial para ejercer temporalmente en otros países de la UE',
            issuer: 'CGCOM',
            type: 'eCIP',
            status: 'available',
            validityYears: 1,
            attributes: [
              { key: 'Nombre completo',     value: u.name },
              { key: 'Número de colegiado', value: u.collegiateNumber },
              { key: 'País de origen',      value: 'España' },
              { key: 'Especialidad',        value: u.specialty },
            ],
            icon: 'file-check',
            color: '#1A5276',
          },
        ]
      : [
          {
            id: 'employee-id',
            name: 'Credencial de Identificación de Empleado (EmployeeID)',
            description: 'Credencial principal que te identifica como empleado de tu organización',
            issuer: this.branding.appName(),
            type: 'EmployeeID',
            status: 'available',
            validityYears: 2,
            attributes: [
              { key: 'Nombre completo',   value: u.name },
              { key: 'Número de empleado', value: u.collegiateNumber },
              { key: 'DNI',               value: u.dni },
              { key: 'Empresa',           value: u.college },
              { key: 'Puesto',            value: u.specialty },
            ],
            icon: 'shield',
            color: 'var(--brand-secondary)',
          },
        ];
  }

  isAlreadyIssued(templateId: string): boolean {
    return this.issuedCredentials().some(
      (ic) => ic.templateId === templateId && ic.status === 'active',
    );
  }

  handleStartIssuance(credential: CredentialTemplate): void {
    this.selectedCredential.set(credential);
    this.issuanceStep.set('confirm');
  }

  handleConfirmIssuance(): void {
    this.issuanceStep.set('qr');
  }

  handleCompleteIssuance(): void {
    const cred = this.selectedCredential();
    if (cred) {
      const now = new Date();
      const expiry = new Date(Date.now() + cred.validityYears * 365 * 24 * 60 * 60 * 1000);
      const newCredential: IssuedCredential = {
        id: `issued-${Date.now()}`,
        templateId: cred.id,
        name: cred.name,
        issueDate: now.toISOString().split('T')[0],
        expiryDate: expiry.toISOString().split('T')[0],
        status: 'active',
        credentialId: `${cred.type.toUpperCase()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      };
      this.issuedCredentials.update((list) => [...list, newCredential]);
      this.successCredentialId = newCredential.credentialId;
      this.successIssueDate = now.toLocaleDateString('es-ES');
      this.successExpiryDate = expiry.toLocaleDateString('es-ES');
    }
    this.issuanceStep.set('success');
  }

  handleRevokeCredential(credentialId: string): void {
    if (confirm('¿Estás seguro de que deseas revocar esta credencial? Esta acción no se puede deshacer.')) {
      this.issuedCredentials.update((list) =>
        list.map((c) => (c.id === credentialId ? { ...c, status: 'revoked' as const } : c)),
      );
    }
  }

  handleReissueCredential(credentialId: string): void {
    const credential = this.issuedCredentials().find((c) => c.id === credentialId);
    if (credential) {
      const template = this.availableCredentials.find((t) => t.id === credential.templateId);
      if (template) {
        this.selectedCredential.set(template);
        this.issuanceStep.set('confirm');
      }
    }
  }

  resetFlow(): void {
    this.selectedCredential.set(null);
    this.issuanceStep.set('list');
  }

  onLogout(): void {
    this.state.clearUser();
    this.router.navigate(['/portal']);
  }

  firstTwoNameWords(): string {
    return this.user.name.split(' ').slice(0, 2).join(' ');
  }
}
