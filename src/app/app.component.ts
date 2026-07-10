import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { IssuanceStateService } from './core/services/issuance-state.service';
import { AuthenticatedUser } from './core/models/issuance.model';

/**
 * AppComponent: raíz de la aplicación. Equivalent al estado global de App.tsx (React).
 *
 * Responsabilidades:
 * - Leer el usuario desde el handoff URL (?u=<base64> o ?identified=1)
 * - Redirigir a la ruta correcta según el estado del handoff
 * - Limpiar la URL tras leer los parámetros (replaceState)
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent implements OnInit {
  private state = inject(IssuanceStateService);
  private router = inject(Router);

  ngOnInit(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const justIdentified = urlParams.get('identified') === '1';

    if (justIdentified) {
      const identifiedUser = this.readIdentifiedUser(urlParams);
      if (identifiedUser) {
        window.history.replaceState(null, '', window.location.pathname);
        this.state.setUser(identifiedUser);
        this.router.navigate(['/portal/doctor-data']);
        return;
      }
    }

    // Si la URL trae ?code= en /portal, el portal CGCOM lo maneja internamente
    // (compatibilidad con el flujo OIDC heredado de la demo; no es el diseño final).
    const isPortalRoute = window.location.pathname.startsWith('/portal');
    if (isPortalRoute && urlParams.get('code')) {
      window.history.replaceState(null, '', window.location.pathname);
      const mockUser: AuthenticatedUser = {
        id: 'DR-OIDC',
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
  }

  /**
   * TEMPORAL: lee el usuario desde el param ?u= (Base64) cuando sessionStorage no está
   * disponible por diferencia de origen (localhost:3000 ≠ localhost:3001).
   * Sustituir por el contrato definitivo de EUDISTACK-622.
   */
  private readIdentifiedUser(urlParams: URLSearchParams): AuthenticatedUser | null {
    try {
      const encoded = urlParams.get('u');
      if (encoded) {
        return JSON.parse(decodeURIComponent(atob(encoded))) as AuthenticatedUser;
      }
      const raw = sessionStorage.getItem('cgcom_identified_user');
      if (raw) {
        sessionStorage.removeItem('cgcom_identified_user');
        return JSON.parse(raw) as AuthenticatedUser;
      }
    } catch {
      // Ignora errores de parseo — el usuario se manda a landing
    }
    return null;
  }
}
