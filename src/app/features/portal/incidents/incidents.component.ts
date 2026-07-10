import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { AuthenticatedUser } from '../../../core/models/issuance.model';

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
  private state = inject(IssuanceStateService);
  private router = inject(Router);

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
    this.router.navigate(['/portal']);
  }

  onLogin(): void {
    // Quick login para demo (equivale a onLogin en React)
    const mockUser: AuthenticatedUser = {
      id: 'DR-12345',
      name: 'Dra. María García López',
      collegiateNumber: '282912345',
      dni: '12345678A',
      email: 'maria.garcia@ejemplo.com',
      phone: '+34 600 123 456',
      college: 'Colegio Oficial de Médicos de Madrid',
      specialty: 'Medicina Familiar y Comunitaria',
      authMethod: 'claveMobile',
    };
    this.state.setUser(mockUser);
    this.router.navigate(['/portal/home']);
  }

  onSubmit(): void {
    // Simula envío del formulario
    setTimeout(() => this.submitted.set(true), 500);
  }
}
