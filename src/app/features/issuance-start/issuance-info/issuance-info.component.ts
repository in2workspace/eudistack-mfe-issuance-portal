import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PortalConfigService } from '../../../core/config/portal-config.service';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';

/** Enlaces legales del pie, en el orden de los wireframes, con su clave de texto. */
const LEGAL_LINKS = [
  { key: 'legal_notice', label: 'issuanceInfo.footer.legalNotice' },
  { key: 'privacy', label: 'issuanceInfo.footer.privacyPolicy' },
  { key: 'terms', label: 'issuanceInfo.footer.termsAndConditions' },
  { key: 'accessibility', label: 'issuanceInfo.footer.accessibility' },
] as const;

/** Una sola `@` y ningún carácter que cambie el sentido de un `mailto:`. */
const PLAIN_EMAIL = /^[^\s@?&#%/\\]+@[^\s@?&#%/\\]+$/;

/**
 * Pantalla de Inicio (prd.md §3.1, wireframes, Inicio): qué es la cartera,
 * cómo funciona el proceso, cómo pedir ayuda y el pie con el soporte y los
 * enlaces legales del tenant, que vienen de `GET /config`.
 */
@Component({
  selector: 'app-issuance-info',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './issuance-info.component.html',
  styleUrl: './issuance-info.component.scss',
})
export class IssuanceInfoComponent {
  private readonly router = inject(Router);
  private readonly session = inject(SESSION_ACTIONS);
  private readonly portalConfig = inject(PortalConfigService);

  readonly currentYear = new Date().getFullYear();

  /** Datos de soporte del tenant; un dato que falta no se muestra. */
  protected readonly support = computed(() => this.portalConfig.config()?.support ?? {});

  /**
   * Enlace para escribir al soporte, solo con una dirección simple: sin `?`,
   * `&`, `#` ni `%`, un correo mal configurado podría añadir destinatarios o
   * cuerpo al `mailto:`. Si no lo es, el correo se muestra como texto.
   */
  protected readonly supportMailto = computed(() => {
    const email = this.support().email;
    return email && PLAIN_EMAIL.test(email) ? `mailto:${email}` : null;
  });

  protected readonly hasSupport = computed(() => {
    const support = this.support();
    return Boolean(support.email || support.phone || support.schedule);
  });

  /** Solo los enlaces legales que trae la configuración, ya validados como https o del mismo origen. */
  protected readonly legalLinks = computed(() => {
    const links = this.portalConfig.config()?.legal_links ?? {};
    return LEGAL_LINKS.filter(({ key }) => links[key]).map(({ key, label }) => ({ href: links[key] as string, label }));
  });

  /**
   * Lleva al titular al inicio de sesión del Verifier. EUD-314 da la
   * implementación real de `restartLogin()`; hasta entonces navega a Inicio.
   */
  onStart(): Promise<void> {
    return this.session.restartLogin();
  }

  navigateToIncidents(): Promise<boolean> {
    return this.router.navigate(['/incidents']);
  }
}
