import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IdentificationRedirectService } from '../../identification/identification-redirect.service';
import { IssuanceStartService } from '../../issuance-start/issuance-start.service';

/** Identificadores de método de identificación que muestra la pantalla. */
export type IdentifyMethod = 'certificate' | 'claveMobile';

/**
 * Selección de método de identificación. La lista es fija hasta que las
 * pantallas de identificación la pidan a `GET /identification/methods`
 * (EUD-285). No simula ninguna identificación: 'certificate' redirige al
 * identificador de certificado (EUD-164) y Cl@ve Móvil aún no está disponible.
 */
@Component({
  selector: 'app-identify-methods',
  imports: [],
  templateUrl: './identify-methods.component.html',
})
export class IdentifyMethodsComponent {
  private readonly router = inject(Router);
  private readonly identificationRedirect = inject(IdentificationRedirectService);
  private readonly issuanceStart = inject(IssuanceStartService);

  protected readonly authMethods: Array<{
    id: IdentifyMethod;
    title: string;
    description: string;
    recommended: boolean;
    available: boolean;
  }> = [
    {
      id: 'certificate',
      title: 'Certificado Digital',
      description: 'Usa tu certificado digital instalado en este dispositivo (ej: FNMT)',
      recommended: true,
      available: true,
    },
    {
      id: 'claveMobile',
      title: 'Cl@ve Móvil',
      description: 'Autentícate usando la aplicación Cl@ve en tu smartphone',
      recommended: false,
      available: false,
    },
  ];

  /**
   * 'certificate' redirige a través de `IdentificationRedirectService`
   * (EUD-164). Si falla (fail-closed), no navega: reporta la razón y vuelve a
   * la pantalla informativa. Un método no disponible no hace nada.
   */
  selectMethod(method: IdentifyMethod): void {
    if (method !== 'certificate') {
      return;
    }
    const reason = this.identificationRedirect.redirectToIdentification();
    if (reason) {
      this.issuanceStart.reportCannotContinue(reason);
      this.router.navigate(['/']);
    }
  }
}
