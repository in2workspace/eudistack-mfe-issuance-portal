import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { resolveTenantIdentity } from '../../core/branding/resolve-tenant-identity';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { IdentificationReturnOutcome } from './identification-return.model';
import { resolveTenantIdentificationConfig } from './resolve-tenant-identification-config';
import { validateIdentificationReturn } from './validate-identification-return';

/**
 * Orquesta el retorno del carril "Certificado Digital" (AC-03/AC-04/AC-05/
 * AC-07). Invocado desde `app.component.ts` en la rama `?identified=1`.
 *
 * El estado inicial es `out_of_scope` (AD-7): si `handleReturn()` nunca se
 * invoca (los otros 4 métodos, que no pasan por esta rama), el resultado
 * publicado sigue siendo "esta Story no opina" — nunca "rechazado".
 *
 * `handleReturn()` evalúa una sola vez por carga de documento (EC-02): la
 * decisión se memoriza en signals de solo lectura; una segunda invocación
 * (re-render, navegación interna) es no-op y no vuelve a consumir la
 * referencia. 100 % síncrono, sin `HttpClient` (NFR-S-164-03).
 */
@Injectable({ providedIn: 'root' })
export class IdentificationReturnService {
  private readonly sessionStore = inject(IssuanceStartSessionStore);
  private readonly configSource = inject(TenantPortalConfigSource);

  private readonly _outcome = signal<IdentificationReturnOutcome>('out_of_scope');
  private readonly _session = signal<IssuanceStartSession | null>(null);
  private readonly _reason = signal<CannotContinueReason | null>(null);

  readonly outcome = this._outcome.asReadonly();
  readonly session = this._session.asReadonly();
  readonly reason = this._reason.asReadonly();

  private evaluated = false;

  handleReturn(location: Pick<Location, 'hostname' | 'search'>): void {
    if (this.evaluated) {
      return;
    }
    this.evaluated = true;

    const session = this.sessionStore.read();
    // AC-07 — identidad de tenant por subdominio, no manipulable por el
    // titular (EUD-166 AD-3); se resuelve el destino de ESTE contexto, no
    // el que reclame la sesión.
    const currentTenant = resolveTenantIdentity(location, environment) ?? '';

    const configResult = resolveTenantIdentificationConfig(currentTenant, this.configSource);
    if (!configResult.ok) {
      this.reject(CannotContinueReason.IdentificationConfigInvalid, session);
      return;
    }

    const params = new URLSearchParams(location.search);
    const decision = validateIdentificationReturn({
      session,
      params,
      config: configResult.config,
      currentTenant,
      now: Date.now(),
    });

    if (decision.outcome === 'rejected') {
      this.reject(decision.reason, session);
      return;
    }

    // AC-05 — uso único: se sella en el mismo turno síncrono de la lectura,
    // antes de publicar el resultado. Si la escritura falla (cuota agotada,
    // storage particionado), NO se publica `correlated` — de lo contrario
    // un segundo retorno con la misma referencia, dentro de la ventana de
    // validez, volvería a evaluar `correlated` (fail-open del uso único,
    // /code-review F1). Mismo criterio fail-closed que ES-05 en la salida
    // (`IdentificationRedirectService`).
    const consumed: IssuanceStartSession = {
      ...decision.session,
      state: 'retomada',
      consumedAt: Date.now(),
    };
    if (!this.sessionStore.update(consumed)) {
      this.reject(CannotContinueReason.Unknown, session);
      return;
    }
    this._session.set(consumed);
    this._reason.set(null);
    this._outcome.set('correlated');
  }

  /**
   * Vuelve al estado inicial `out_of_scope` — invocado desde
   * `IssuanceStartService.retry()`. Sin esto, un rechazo previo dejaba
   * `outcome()` pegado en `'rejected'` para el resto de la carga de
   * documento y `identificationReturnGuard` denegaba también a los 4
   * métodos fuera de alcance tras reintentar (regresión de AC-08,
   * /code-review F2).
   */
  reset(): void {
    this.evaluated = false;
    this._outcome.set('out_of_scope');
    this._session.set(null);
    this._reason.set(null);
  }

  private reject(reason: CannotContinueReason, session: IssuanceStartSession | null): void {
    this._session.set(session);
    this._reason.set(reason);
    this._outcome.set('rejected');
  }
}
