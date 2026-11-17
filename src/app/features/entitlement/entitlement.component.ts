import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ApiProblemError,
  AUTHENTIC_SOURCE_UNAVAILABLE,
  NETWORK_ERROR,
  UNEXPECTED_ERROR,
} from '../../core/api/api-problem.error';
import { EntitlementApi, EntitlementResult } from '../../core/api/generated/authentic-source';
import { HolderAuthService } from '../../core/auth/holder-auth.service';
import { EntitlementOutcomeStore } from '../../core/journey/entitlement-outcome.store';
import { EMAIL_PATH, NO_REQUESTS_PATH, REQUEST_UNAVAILABLE_PATH } from '../../core/journey/journey-paths';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
import { errorUrl } from '../error/error-reason';

/**
 * Fallos con los que Comprobación muestra «fuente no disponible», que deja
 * reintentar sin volver a identificarse. Además del 503 del contrato, la
 * orden no dice qué hacer sin respuesta o con un error sin Problem: se tratan
 * igual. `journey_closed` y `step_not_allowed` los resuelve el interceptor de
 * EUD-287 y el 401, EUD-314: aquí no se pinta nada para ellos.
 */
const RETRYABLE_FAILURES: ReadonlySet<string> = new Set([AUTHENTIC_SOURCE_UNAVAILABLE, NETWORK_ERROR, UNEXPECTED_ERROR]);

/**
 * Paso Comprobación (wireframes, Comprobación; design.md AD-13): saluda al
 * titular por su nombre, con cómo volver a entrar si no es él, y mientras
 * Fuente auténtica comprueba sus solicitudes muestra un indicador de espera.
 * Después pasa solo a Correo (al menos una solicitud disponible), a Sin
 * solicitudes, a Tus datos no coinciden (su única solicitud no está
 * disponible) o a la pantalla de error de sin derecho. Cuando la fuente no
 * confirma ninguna solicitud el servicio retira el recorrido y los tokens se
 * descartan (design.md §3.1, punto 7). La ruta la protege `journeyStepGuard`.
 */
@Component({
  selector: 'app-entitlement',
  imports: [TranslatePipe],
  templateUrl: './entitlement.component.html',
})
export class EntitlementComponent implements OnInit {
  private readonly entitlementApi = inject(EntitlementApi);
  private readonly router = inject(Router);
  private readonly session = inject(SESSION_ACTIONS);
  private readonly outcome = inject(EntitlementOutcomeStore);
  private readonly destroyRef = inject(DestroyRef);

  /** Nombre del ID Token; vacío si no lo trae (AD-13). */
  protected readonly givenName = inject(HolderAuthService).givenName;

  ngOnInit(): void {
    this.entitlementApi
      .verifyEntitlement()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.onResult(result),
        error: (error: unknown) => this.onFailure(error),
      });
  }

  /** «¿No eres …?»: vuelve al Verifier para identificarse otra vez. */
  protected onNotYou(): void {
    void this.session.restartLogin();
  }

  private onResult(result: EntitlementResult): void {
    if (result.result === 'confirmed') {
      this.leaveTo(['/', EMAIL_PATH]);
      return;
    }
    // El servicio ya ha retirado el recorrido: los tokens se descartan ya,
    // no solo al pulsar «Volver al inicio» (design.md §3.1, punto 7; review W4).
    this.session.discardTokens();
    this.leaveTo(this.notConfirmedUrl(result));
  }

  /**
   * Sin motivo (hay solicitudes y ninguna disponible), Tus datos no coinciden:
   * con la solicitud única, o con la lista de cada una y qué hacer (decisión
   * del Tech Lead para varias solicitudes, tasks.md, tarea 5).
   */
  private notConfirmedUrl(result: EntitlementResult): string[] {
    if (result.reason === 'no_requests') {
      this.outcome.hold({ kind: 'no-requests' });
      return ['/', NO_REQUESTS_PATH];
    }
    if (result.reason === undefined && result.requests.length > 0) {
      this.outcome.hold({ kind: 'request-unavailable', requests: result.requests });
      return ['/', REQUEST_UNAVAILABLE_PATH];
    }
    return errorUrl('not-entitled');
  }

  private onFailure(error: unknown): void {
    if (error instanceof ApiProblemError && RETRYABLE_FAILURES.has(error.type)) {
      this.leaveTo(errorUrl('source-unavailable'));
    }
  }

  /** Sin dejar Comprobación en el historial: «atrás» no debe repetir la comprobación. */
  private leaveTo(url: string[]): void {
    void this.router.navigate(url, { replaceUrl: true });
  }
}
