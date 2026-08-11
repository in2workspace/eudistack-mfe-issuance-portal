import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { resolveSupportEmail } from '../../../core/branding/resolve-support-email';
import { environment } from '../../../../environments/environment';

/** Único tenant con emisión DoctorID hoy; el resto ve el copy/datos genéricos de empleado. */
function resolveIsDoctorTenant(): boolean {
  return resolveTenantIdentity(window.location, environment) === 'cgcom';
}

type IncidentType = 'technical' | 'access' | 'credentials' | 'other' | '';

interface IncidentForm {
  name: string;
  email: string;
  phone: string;
  incidentType: IncidentType;
  subject: string;
  description: string;
}

/**
 * Canal de soporte — formulario de incidencias.
 * Equivalente a IncidentsPage.tsx (React).
 */
@Component({
  selector: 'app-incidents',
  imports: [CommonModule, FormsModule],
  templateUrl: './incidents.component.html',
})
export class IncidentsComponent {
  private router = inject(Router);
  protected readonly branding = inject(BrandingService);
  protected readonly isDoctorTenant = resolveIsDoctorTenant();
  protected readonly supportEmail = resolveSupportEmail();

  readonly submitted = signal(false);
  readonly ticketNumber = `INC-${Date.now().toString().slice(-8)}`;

  formData: IncidentForm = {
    name: '',
    email: '',
    phone: '',
    incidentType: '',
    subject: '',
    description: '',
  };

  readonly incidentTypes = [
    { value: 'technical',    label: 'Problema Técnico' },
    { value: 'access',      label: 'Problemas de Acceso' },
    { value: 'credentials', label: 'Gestión de Credenciales' },
    { value: 'other',       label: 'Otro' },
  ];

  onBack(): void {
    this.router.navigate(['/']);
  }

  onSubmit(): void {
    // Simula envío del formulario
    setTimeout(() => this.submitted.set(true), 500);
  }
}
