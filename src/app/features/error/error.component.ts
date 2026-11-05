import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { combineLatest, map } from 'rxjs';
import { TenantLanguageService } from '../../core/branding/tenant-language.service';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { ENTITLEMENT_PATH, QR_PATH } from '../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
import { ErrorReason, isErrorReason } from './error-reason';

/**
 * Pantalla de error única (prd.md §3.4, wireframes, Error): título, texto y
 * acción principal de cada caso, sin códigos ni nombres de sistemas. Solo el
 * caso sin derecho muestra el contacto del soporte del tenant. El caso viene
 * de `error/:reason`, o de `data.reason` en la ruta de configuración no
 * disponible, que no depende de la configuración.
 */
@Component({
  selector: 'app-error',
  imports: [TranslateModule],
  templateUrl: './error.component.html',
})
export class ErrorComponent {
  private readonly router = inject(Router);
  private readonly session = inject(SESSION_ACTIONS);
  private readonly portalConfig = inject(PortalConfigService);
  private readonly language = inject(TenantLanguageService);

  private readonly route = inject(ActivatedRoute);

  protected readonly reason = toSignal(
    combineLatest([this.route.paramMap, this.route.data]).pipe(
      map(([params, data]) => params.get('reason') ?? (data['reason'] as unknown)),
      map((reason) => (isErrorReason(reason) ? reason : null)),
    ),
    { initialValue: null },
  );

  protected readonly retrying = signal(false);

  protected readonly support = computed(() => {
    if (this.reason() !== 'not-entitled') {
      return null;
    }
    const support = this.portalConfig.config()?.support;
    return support?.email || support?.phone || support?.schedule ? support : null;
  });

  async onAction(): Promise<void> {
    const reason = this.reason();
    if (reason === null || this.retrying()) {
      return;
    }
    this.retrying.set(true);
    try {
      await this.actionFor(reason)();
    } finally {
      this.retrying.set(false);
    }
  }

  private actionFor(reason: ErrorReason): () => Promise<unknown> {
    switch (reason) {
      case 'config-unavailable':
        return () => this.retryConfig();
      case 'identification-failed':
        return () => this.session.restartLogin();
      case 'source-unavailable':
        return () => this.router.navigate(['/', ENTITLEMENT_PATH]);
      case 'issuance-failed':
      case 'onboarding-unavailable':
        // QR (generando) repite la llamada que falló con los mismos datos (EUD-286).
        return () => this.router.navigate(['/', QR_PATH]);
      case 'offer-not-renewable':
      case 'not-entitled':
        // El recorrido ya ha terminado o lo ha retirado el servicio (design.md §3.1, punto 7).
        return () => {
          this.session.discardTokens();
          return this.router.navigate(['/']);
        };
      case 'session-expired':
        // Los tokens ya se descartaron al llegar aquí (JourneyNavigator.expireSession).
        return () => this.router.navigate(['/']);
    }
  }

  /**
   * Vuelve a pedir la configuración y, si responde, recarga los textos para
   * añadir los del tenant y va a Inicio. Si no, el titular sigue aquí y puede
   * volver a intentarlo (ES-03).
   */
  private async retryConfig(): Promise<void> {
    try {
      const state = await this.portalConfig.load();
      if (state.status === 'loaded') {
        await this.language.reloadTexts();
        await this.router.navigate(['/']);
      }
    } catch {
      // Sin los textos del tenant no se va a Inicio: el titular puede reintentar.
    }
  }
}
