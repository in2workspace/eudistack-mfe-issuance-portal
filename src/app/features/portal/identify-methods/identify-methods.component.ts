import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BrandingService } from '../../../core/branding/branding.service';
import { resolveTenantIdentity } from '../../../core/branding/resolve-tenant-identity';
import { environment } from '../../../../environments/environment';
import { IssuanceStateService } from '../../../core/services/issuance-state.service';
import { DoctorIdOidcService } from '../../../core/services/doctorid-oidc.service';
import { AuthenticatedUser } from '../../../core/models/issuance.model';

/** Identificadores de método de identificación — puerto de AuthMethod (cert-identifier). */
export type IdentifyMethod = 'eDNI' | 'certificate' | 'claveMobile' | 'doctorId' | 'video';

/** Único tenant con emisión DoctorID hoy; el resto ve la credencial genérica de empleado. */
function resolveCredentialLabel(): string {
  return resolveTenantIdentity(window.location, environment) === 'cgcom' ? 'DoctorID' : 'EmployeeID';
}

/** Perfil demo por tenant (nombre/departamento/puesto): CGCOM emite para médicos colegiados; el resto, para empleados del grupo. */
interface DemoProfile {
  mockId: string;
  mockName: string;
  mockEmail: string;
  college: string;
  specialty: string;
}

const DOCTOR_DEMO_PROFILE: DemoProfile = {
  mockId: 'DR-12345',
  mockName: 'Dra. Maria Garcia Lopez',
  mockEmail: 'maria.garcia@ejemplo.com',
  college: 'Col·legi de Metges de Barcelona',
  specialty: 'Oftalmología',
};

const EMPLOYEE_DEMO_PROFILE: DemoProfile = {
  mockId: 'EMP-12345',
  mockName: 'María García López',
  mockEmail: 'maria.garcia@altia.es',
  college: 'Altia Consultoría y Tecnología',
  specialty: 'Consultor de Tecnología',
};

const CALIDALIA_DEMO_PROFILE: DemoProfile = {
  ...EMPLOYEE_DEMO_PROFILE,
  college: 'Gallo',
  specialty: 'Responsable de Calidad',
};

/** Perfiles demo por tenant específico; el resto de tenants cae al genérico de empleado. */
const DEMO_PROFILES_BY_TENANT: Record<string, DemoProfile> = {
  cgcom: DOCTOR_DEMO_PROFILE,
  calidalia: CALIDALIA_DEMO_PROFILE,
};

function resolveDemoProfile(): DemoProfile {
  const tenant = resolveTenantIdentity(window.location, environment);
  return (tenant && DEMO_PROFILES_BY_TENANT[tenant]) || EMPLOYEE_DEMO_PROFILE;
}

/**
 * Selección de método de identificación (AC-02+) + autenticación de eDNI,
 * Cl@ve Móvil, DoctorID y Video (extraídos del paso 'authenticate' de
 * ClaveAuthComponent en eudistack-cgcom-mfe-cert-identifier — duplicado
 * intencional del mismo criterio que AuthenticatedUser, hasta que exista un
 * paquete de contrato compartido, EUDISTACK-621/622).
 *
 * Solo 'certificate' sigue redirigiendo a cert-identifier (`/cert/`) — su
 * popup mTLS depende de cert-server.mjs, imposible de mover sin backend.
 */
@Component({
  selector: 'app-identify-methods',
  imports: [],
  templateUrl: './identify-methods.component.html',
})
export class IdentifyMethodsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly issuanceState = inject(IssuanceStateService);
  private readonly doctorIdOidcService = inject(DoctorIdOidcService);
  protected readonly branding = inject(BrandingService);

  // ── State (signals) ───────────────────────────────────────────────────────
  protected readonly selectedMethod = signal<IdentifyMethod | null>(null);
  protected readonly isAuthenticating = signal(false);

  /** Mock fields — eDNI flow (deshabilitado, preservado para futura activación). */
  protected readonly dni = signal('12345678A');
  protected readonly pin = signal('1234');

  /** DoctorID OIDC callback state. */
  protected readonly doctorIdLoading = signal(false);
  protected readonly doctorIdError = signal<string | null>(null);

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

  ngOnInit(): void {
    // Detecta el callback OIDC de vuelta del verifier (flujo DoctorID).
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      this.handleOidcCallback(code, state);
    }
  }

  onBack(): void {
    this.router.navigate(['/']);
  }

  /**
   * 'certificate' sigue redirigiendo a cert-identifier (same-origin,
   * cross-app — AD-2). El resto se autentica aquí mismo; 'doctorId' redirige
   * de inmediato al flujo OIDC sin mostrar ninguna UI intermedia (igual que
   * antes en cert-identifier).
   */
  selectMethod(method: IdentifyMethod): void {
    if (method === 'certificate') {
      window.location.href = '/cert/?method=certificate';
      return;
    }
    if (method === 'doctorId') {
      this.doctorIdOidcService.iniciarFlujoOIDCPortal();
      return;
    }
    this.selectedMethod.set(method);
  }

  /** Vuelve a la lista de métodos — puramente local, ya no cross-app. */
  goToSelection(): void {
    this.selectedMethod.set(null);
    this.isAuthenticating.set(false);
    this.doctorIdError.set(null);
  }

  /** Autentica con datos mock — eDNI, Cl@ve Móvil y Video (entorno demo). */
  protected handleAuthenticate(): void {
    this.isAuthenticating.set(true);
    const profile = resolveDemoProfile();
    setTimeout(() => {
      const mockUser: AuthenticatedUser = {
        id: profile.mockId,
        name: profile.mockName,
        collegiateNumber: '282912345',
        dni: this.dni(),
        email: profile.mockEmail,
        phone: '+34 600 123 456',
        college: profile.college,
        specialty: profile.specialty,
        authMethod: this.selectedMethod() as 'eDNI' | 'claveMobile' | 'video',
      };
      this.onAuthenticated(mockUser);
    }, 2000);
  }

  private handleOidcCallback(code: string, state: string): void {
    const savedState = sessionStorage.getItem('doctorid_oidc_state');
    if (state !== savedState) {
      this.doctorIdError.set('Error de seguridad: state no coincide. Por favor, inicia el proceso de nuevo.');
      this.selectedMethod.set('doctorId');
      return;
    }

    // Clean URL without triggering navigation
    history.replaceState({}, '', window.location.pathname);

    this.selectedMethod.set('doctorId');
    this.doctorIdLoading.set(true);
    this.doctorIdError.set(null);

    this.doctorIdOidcService.completarFlujoOIDCPortal(code).then(user => {
      this.onAuthenticated(user);
    }).catch((err: unknown) => {
      this.doctorIdLoading.set(false);
      this.doctorIdError.set(
        err instanceof Error ? err.message : `Error al completar la autenticación con ${this.credentialLabel}.`
      );
    });
  }

  /**
   * Handoff a la pantalla de datos del usuario — directo vía
   * IssuanceStateService/Router, ya en la misma app (a diferencia de
   * 'certificate', que sigue llegando por querystring Base64 desde
   * cert-identifier — ver AppComponent.readIdentifiedUser()).
   */
  private onAuthenticated(user: AuthenticatedUser): void {
    this.issuanceState.setUser(user);
    this.router.navigate(['/user-data']);
  }
}
