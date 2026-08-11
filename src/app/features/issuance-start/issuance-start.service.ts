import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IssuanceStartSession } from './issuance-start-session.model';
import { IssuanceStartSessionStore } from './issuance-start-session.store';
import { CannotContinueReason } from './cannot-continue-reason';

/** Genera un identificador de arranque único: 16 bytes aleatorios en Base64 URL-safe. */
function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Orquesta el arranque de la emisión desde la pantalla informativa (AC-02).
 *
 * Crea la sesión de arranque, aplica un guard de double-submit (EC-02) y
 * navega a la pantalla de selección de método de identificación
 * ('portal/identify', misma SPA). Si la sesión no puede crearse (ES-03),
 * fuerza el estado "no se puede continuar" sin navegar (fail-closed).
 */
@Injectable({ providedIn: 'root' })
export class IssuanceStartService {
  private readonly sessionStore = inject(IssuanceStartSessionStore);
  private readonly router = inject(Router);

  private readonly _isStarting = signal(false);
  readonly isStarting = this._isStarting.asReadonly();

  private readonly _cannotContinueReason = signal<CannotContinueReason | null>(null);
  readonly cannotContinueReason = this._cannotContinueReason.asReadonly();

  start(tenant: string): void {
    if (this._isStarting()) {
      return;
    }
    this._isStarting.set(true);

    const session: IssuanceStartSession = { id: generateSessionId(), tenant, state: 'iniciada' };
    const persisted = this.sessionStore.create(session);
    if (!persisted) {
      this._cannotContinueReason.set(CannotContinueReason.Unknown);
      this._isStarting.set(false);
      return;
    }

    this.router.navigate(['/identify']);
  }

  /** Descarta la señal de error y vuelve al estado informativo por defecto (AC-06). */
  retry(): void {
    this._cannotContinueReason.set(null);
  }
}
