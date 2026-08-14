import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { IssuanceStateService } from './core/services/issuance-state.service';
import { AuthenticatedUser } from './core/models/issuance.model';
import { IdentificationReturnService } from './features/identification/identification-return.service';
import { IssuanceStartService } from './features/issuance-start/issuance-start.service';

/**
 * AppComponent: raíz de la aplicación. Equivalent al estado global de App.tsx (React).
 *
 * Responsabilidades:
 * - Leer el usuario desde el handoff URL (?u=<base64> o ?identified=1)
 * - Redirigir a la ruta correcta según el estado del handoff
 * - Limpiar la URL tras leer los parámetros (replaceState)
 * - EUD-164: evaluar el retorno del carril "Certificado Digital" (AC-03/
 *   AC-04) ANTES de fijar el usuario — un retorno rechazado no debe
 *   producir sesión de usuario en ningún caso.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent implements OnInit {
  private state = inject(IssuanceStateService);
  private router = inject(Router);
  private identificationReturn = inject(IdentificationReturnService);
  private issuanceStart = inject(IssuanceStartService);

  ngOnInit(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const justIdentified = urlParams.get('identified') === '1';

    if (justIdentified) {
      this.identificationReturn.handleReturn(window.location);

      if (this.identificationReturn.outcome() === 'rejected') {
        window.history.replaceState(null, '', window.location.pathname);
        const reason = this.identificationReturn.reason();
        if (reason) {
          this.issuanceStart.reportCannotContinue(reason);
        }
        this.router.navigate(['/']);
        return;
      }

      const identifiedUser = this.readIdentifiedUser(urlParams);
      if (identifiedUser) {
        window.history.replaceState(null, '', window.location.pathname);
        this.state.setUser(identifiedUser);
        this.router.navigate(['/user-data']);
        return;
      }
    }

    // Si la URL trae ?code= exactamente en la raíz de la app (redirect_uri
    // real del flujo OIDC ACME), el portal CGCOM lo maneja internamente aquí
    // (compatibilidad con el flujo heredado de la demo; no es el diseño
    // final). window.location.pathname es una API nativa del DOM — NO la
    // afecta el <base href> de Angular, así que hay que comparar contra el
    // path real completo (incluye el SPA_PREFIX de despliegue), no contra
    // la ruta relativa de Angular. Coincidencia EXACTA, no un prefijo:
    // 'identify' tiene su propio callback OIDC real (DoctorID,
    // IdentifyMethodsComponent) — un match por prefijo lo secuestraría
    // antes de que se procese ahí.
    const isPortalRoute = window.location.pathname === '/issuance-portal/';
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
      // /portal/home se retiró (movido/duplicado en eudistack-cgcom-mfe-demo);
      // no hay otro "home" real en esta app.
      this.router.navigate(['/']);
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
