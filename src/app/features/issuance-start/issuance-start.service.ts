import { Injectable, inject, signal } from '@angular/core';
import { IssuanceStartSessionStore } from './issuance-start-session.store';
import { ExternalNavigator } from '../../core/services/external-navigator.service';
import { resolveIssuanceStartUrl } from '../../core/config/issuance.config';
import { CannotContinueReason, toCannotContinueReason } from './cannot-continue-reason';

/**
 * Orquesta el arranque de la emisión desde la pantalla informativa (AC-02).
 *
 * Crea la sesión de arranque, aplica un guard de double-submit (EC-02) y
 * delega la navegación externa. Si la sesión no puede crearse (ES-03),
 * fuerza el estado "no se puede continuar" sin navegar (fail-closed).
 */
@Injectable({ providedIn: 'root' })
export class IssuanceStartService {
  private readonly sessionStore = inject(IssuanceStartSessionStore);
  private readonly navigator = inject(ExternalNavigator);

  private readonly _isStarting = signal(false);
  readonly isStarting = this._isStarting.asReadonly();

  private readonly _cannotContinueReason = signal<CannotContinueReason | null>(null);
  readonly cannotContinueReason = this._cannotContinueReason.asReadonly();

  start(tenant: string): void {
    if (this._isStarting()) {
      return;
    }
    this._isStarting.set(true);

    const session = this.sessionStore.create(tenant);
    if (session === null) {
      this._cannotContinueReason.set(toCannotContinueReason(undefined));
      this._isStarting.set(false);
      return;
    }

    this.navigator.redirect(resolveIssuanceStartUrl());
  }

  /** Descarta la señal de error y vuelve al estado informativo por defecto (AC-06). */
  retry(): void {
    this._cannotContinueReason.set(null);
  }
}
