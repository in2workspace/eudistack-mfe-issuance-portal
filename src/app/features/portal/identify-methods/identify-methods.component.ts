import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';

/** Identificadores de método de identificación — puerto de AuthMethod (cert-identifier). */
export type IdentifyMethod = 'eDNI' | 'certificate' | 'claveMobile' | 'doctorId' | 'video';

/** Único tenant con emisión DoctorID hoy; el resto ve la credencial genérica de empleado. */
function resolveCredentialLabel(): string {
  return resolveTenantIdentity(window.location, environment) === 'cgcom' ? 'DoctorID' : 'EmployeeID';
}

/**
 * Selección de método de identificación (AC-02+).
 *
 * Extraída del paso 'select' de ClaveAuthComponent en
 * eudistack-cgcom-mfe-cert-identifier: la selección vive ahora aquí; al
 * elegir un método se redirige (same-origin, cross-app, AD-2) a `/cert/`
 * con el método ya elegido — cert-identifier entra directo en su paso
 * 'authenticate' para ese método, sin volver a mostrar esta lista.
 */
@Component({
  selector: 'app-identify-methods',
  imports: [],
  templateUrl: './identify-methods.component.html',
})
export class IdentifyMethodsComponent {
  private readonly router = inject(Router);
  protected readonly branding = inject(BrandingService);

  /** DoctorID para CGCOM, EmployeeID para el resto de tenants. */
  protected readonly credentialLabel = resolveCredentialLabel();

  protected readonly authMethods: Array<{
    id: IdentifyMethod;
    title: string;
    description: string;
    recommended: boolean;
  }> = [
    { id: 'eDNI', title: 'DNI Electrónico',
      description: 'Autentícate usando tu DNI electrónico y un lector de tarjetas',
      recommended: false },
    {
      id: 'certificate',
      title: 'Certificado Digital',
      description: 'Usa tu certificado digital instalado en este dispositivo (ej: FNMT)',
      recommended: true,
    },
    { id: 'claveMobile', title: 'Cl@ve Móvil',
      description: 'Autentícate usando la aplicación Cl@ve en tu smartphone',
      recommended: false },
    { id: 'doctorId', title: this.credentialLabel,
      description: `Accede con tu credencial verificable ${this.credentialLabel} desde tu cartera digital`,
      recommended: false },
    { id: 'video', title: 'Video Identificación',
      description: 'Identifícate en tiempo real con un agente verificador mediante videollamada',
      recommended: false },
  ];

  onBack(): void {
    this.router.navigate(['/portal']);
  }

  /**
   * Redirige a cert-identifier con el método ya elegido (same-origin,
   * cross-app — AD-2). cert-identifier entra directo en 'authenticate'
   * para ese método; para 'doctorId' redirige de inmediato al flujo OIDC
   * sin mostrar ninguna UI intermedia (comportamiento sin cambios ahí).
   */
  selectMethod(method: IdentifyMethod): void {
    window.location.href = `/cert/?method=${method}`;
  }
}
