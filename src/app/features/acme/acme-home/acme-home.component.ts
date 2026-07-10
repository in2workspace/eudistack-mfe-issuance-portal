import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AcmeHeaderComponent } from '../acme-header/acme-header.component';
import { AcmeFooterComponent } from '../acme-footer/acme-footer.component';

interface Servicio {
  titulo: string;
  descripcion: string;
  /** Nombre del icono (usado para la rama @if en el template) */
  icon: 'file-text' | 'calendar' | 'users' | 'shield';
  color: string;
}

const DEMO_USER_NAME = 'Dr. García López';

/**
 * Portal de servicios del profesional ACME.
 * Equivalente a AcmeHomePage.tsx (React).
 */
@Component({
  selector: 'app-acme-home',
  imports: [CommonModule, AcmeHeaderComponent, AcmeFooterComponent],
  templateUrl: './acme-home.component.html',
})
export class AcmeHomeComponent {
  private router = inject(Router);

  readonly userName = DEMO_USER_NAME;

  readonly servicios: Servicio[] = [
    {
      titulo: 'Receta Electrónica',
      descripcion: 'Emite y gestiona recetas electrónicas para tus pacientes de forma segura y verificable.',
      icon: 'file-text',
      color: '#E67E22',
    },
    {
      titulo: 'Agenda Clínica',
      descripcion: 'Consulta y organiza tu agenda de citas, turnos y disponibilidad en el centro.',
      icon: 'calendar',
      color: '#1A5276',
    },
    {
      titulo: 'Directorio de Pacientes',
      descripcion: 'Accede al directorio de pacientes asignados y consulta su historial clínico.',
      icon: 'users',
      color: '#2874A6',
    },
    {
      titulo: 'Certificados Profesionales',
      descripcion: 'Descarga y gestiona tus credenciales y certificados profesionales verificables.',
      icon: 'shield',
      color: '#D35400',
    },
  ];

  handleSalir(): void {
    this.router.navigate(['/cliente'], { replaceUrl: true });
  }

  onServiceHoverEnter(event: MouseEvent, color: string): void {
    const btn = event.currentTarget as HTMLButtonElement;
    btn.style.backgroundColor = color;
    btn.style.color = 'white';
  }

  onServiceHoverLeave(event: MouseEvent, color: string): void {
    const btn = event.currentTarget as HTMLButtonElement;
    btn.style.backgroundColor = 'transparent';
    btn.style.color = color;
  }
}
