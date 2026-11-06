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
import { DATA_PATH } from '../../core/journey/journey-paths';
import { errorUrl } from '../error/error-reason';

/**
 * Fallos con los que Comprobación muestra «fuente no disponible», que deja
 * reintentar sin volver a identificarse. Además del 503 del contrato, la
 * orden no dice qué hacer sin respuesta o con un error sin Problem: se tratan
 * igual. `journey_closed` y `step_not_allowed` los resuelve el interceptor de
 * EUD-287 y el 401, EUD-314: aquí no se pinta nada para ellos.
 */
const RETRYABLE_FAILURES: readonly string[] = [AUTHENTIC_SOURCE_UNAVAILABLE, NETWORK_ERROR, UNEXPECTED_ERROR];

/**
 * Paso Comprobación (wireframes, Comprobación): mientras el módulo de fuente
 * auténtica comprueba el derecho, un indicador de espera; después pasa solo a
 * Datos o a la pantalla de error. La ruta la protege `journeyStepGuard`.
 */
@Component({
  selector: 'app-entitlement',
  imports: [TranslatePipe],
  templateUrl: './entitlement.component.html',
})
export class EntitlementComponent implements OnInit {
  private readonly entitlementApi = inject(EntitlementApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.entitlementApi
      .verifyEntitlement()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.onResult(result),
        error: (error: unknown) => this.onFailure(error),
      });
  }

  private onResult(result: EntitlementResult): void {
    if (result.result === 'confirmed') {
      this.leaveTo(['/', DATA_PATH]);
    } else {
      // El servicio ya ha retirado el recorrido; la pantalla de error descarta los tokens.
      this.leaveTo(errorUrl('not-entitled'));
    }
  }

  private onFailure(error: unknown): void {
    if (error instanceof ApiProblemError && RETRYABLE_FAILURES.includes(error.type)) {
      this.leaveTo(errorUrl('source-unavailable'));
    }
  }

  /** Sin dejar Comprobación en el historial: «atrás» no debe repetir la comprobación. */
  private leaveTo(url: string[]): void {
    void this.router.navigate(url, { replaceUrl: true });
  }
}
