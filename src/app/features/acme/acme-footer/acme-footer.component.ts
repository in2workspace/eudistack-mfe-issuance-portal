import { Component } from '@angular/core';

/**
 * Barra de pie de página corporativa ACME.
 * Equivalente a AcmeFooter.tsx (React). Sin props — reutilizable en landing y home.
 */
@Component({
  selector: 'app-acme-footer',
  template: `
    <footer class="bg-gray-900 text-gray-400 py-3 z-20 relative">
      <div class="max-w-7xl mx-auto px-4 text-center text-xs space-x-3">
        <span>&copy; {{ currentYear }} Acme Corp</span>
        <span>·</span>
        <a href="#" (click)="$event.preventDefault()" class="hover:text-white">Política de cookies</a>
        <span>·</span>
        <a href="#" (click)="$event.preventDefault()" class="hover:text-white">Accesibilidad</a>
        <span>·</span>
        <a href="#" (click)="$event.preventDefault()" class="hover:text-white">Aviso Legal</a>
      </div>
    </footer>
  `,
})
export class AcmeFooterComponent {
  readonly currentYear = new Date().getFullYear();
}
