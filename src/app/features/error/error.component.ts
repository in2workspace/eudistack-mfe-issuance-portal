import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { map } from 'rxjs';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { ENTITLEMENT_PATH, QR_PATH } from '../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
import { ErrorReason, isErrorReason } from './error-reason';

/**
 * Pantalla de error única (prd.md §3.4, wireframes, Error): título, texto y
 * acción principal de cada caso, sin códigos ni nombres de sistemas. Solo el
 * caso sin derecho muestra el contacto del soporte del tenant.
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

  protected readonly reason = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => {
        const reason = params.get('reason');
        return isErrorReason(reason) ? reason : null;
      }),
    ),
    { initialValue: null },
  );

  protected readonly support = computed(() => {
    if (this.reason() !== 'not-entitled') {
      return null;
    }
    const support = this.portalConfig.config()?.support;
    return support?.email || support?.phone || support?.schedule ? support : null;
  });

  async onAction(): Promise<void> {
    const reason = this.reason();
    if (reason !== null) {
      await this.actionFor(reason)();
    }
  }

  private actionFor(reason: ErrorReason): () => Promise<unknown> {
    switch (reason) {
      case 'identification-failed':
        return () => this.session.restartLogin();
      case 'source-unavailable':
        return () => this.router.navigate(['/', ENTITLEMENT_PATH]);
      case 'issuance-failed':
      case 'onboarding-unavailable':
        // QR (generando) repite la llamada que falló con los mismos datos (EUD-286).
        return () => this.router.navigate(['/', QR_PATH]);
      case 'offer-not-renewable':
        return () => {
          this.session.discardTokens();
          return this.router.navigate(['/']);
        };
      case 'not-entitled':
      case 'session-expired':
        return () => this.router.navigate(['/']);
    }
  }
}
