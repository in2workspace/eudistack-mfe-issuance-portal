import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandingService } from '../../../core/branding/branding.service';

/**
 * Cabecera corporativa reutilizable. Equivalente a AcmeHeader.tsx (React).
 * Logo y nombre de app proceden de `BrandingService` (EUD-166) — sin marca
 * incrustada. El encabezado definitivo lo define EUD-162; hasta entonces se
 * aplica sobre este componente (R-4).
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
            <img [src]="branding.logoUrl()" [alt]="branding.appName()" class="h-10 w-auto" />
            <span class="text-xl sm:text-2xl font-bold text-brand-accent leading-tight">{{ branding.appName() }}</span>
          </div>
          <ng-content />
        </div>
      </div>
    </header>
  `,
})
export class AcmeHeaderComponent {
  protected readonly branding = inject(BrandingService);
}
