import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { resolveSupportEmail } from '../../../core/branding/resolve-support-email';

/**
 * Pantalla de inicio del Portal CGCOM.
 * Equivalente a LandingPage.tsx (React).
 */
@Component({
  selector: 'app-landing',
  imports: [],
  templateUrl: './landing.component.html',
})
export class LandingComponent {
  private router = inject(Router);

  readonly currentYear = new Date().getFullYear();
  protected readonly supportEmail = resolveSupportEmail();

  readonly useCases = [
    { title: 'Receta Electrónica', description: 'Prescribe medicamentos de forma digital con tu credencial profesional' },
    { title: 'Telemedicina', description: 'Autentícate en plataformas de consulta online de manera segura' },
    { title: 'Acceso Hospitalario', description: 'Identifícate en sistemas hospitalarios sin múltiples contraseñas' },
    { title: 'Historia Clínica Digital', description: 'Consulta historiales médicos con credenciales verificadas' },
    { title: 'Sistemas Autonómicos', description: 'Compatible con todas las plataformas sanitarias regionales' },
    { title: 'Servicios del Colegio', description: 'Accede a todos los servicios de tu colegio oficial de médicos' },
  ];

  /**
   * Inicia identificación → redirige al Portal de Identificación con certificado FNMT.
   * Ruta same-origin (nginx sirve `/cert/` igual bajo cualquier subdominio de tenant).
   */
  startIdentification(): void {
    window.location.href = '/cert/';
  }

  navigateToIncidents(): void {
    this.router.navigate(['/portal/incidents']);
  }

  contactByEmail(): void {
    window.location.href = `mailto:${this.supportEmail}`;
  }
}
