import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Cabecera corporativa ACME reutilizable.
 * Equivalente a AcmeHeader.tsx (React).
 *
 * @param actions Contenido proyectado a la derecha (p.ej. botón "Salir").
 */
@Component({
  selector: 'app-acme-header',
  imports: [CommonModule],
  template: `
    <header class="bg-white shadow-sm z-20 relative">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-6">
            <img src="acme-logo.png" alt="ACME Corp" class="h-10 w-auto" />
            <span class="text-xl sm:text-2xl font-bold text-[#1A5276] leading-tight">Portal del Profesional de ACME</span>
          </div>
          <ng-content />
        </div>
      </div>
    </header>
  `,
})
export class AcmeHeaderComponent {}
