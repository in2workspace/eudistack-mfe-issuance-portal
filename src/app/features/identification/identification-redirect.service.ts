import { Injectable, inject } from '@angular/core';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { ExternalNavigator } from '../../core/services/external-navigator.service';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { IssuanceStartSession } from '../issuance-start/issuance-start-session.model';
import { ISSUANCE_START_SESSION_TTL_MS } from '../issuance-start/issuance-start-session.expiry';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { createCorrelationToken } from './identification-correlation-token';
import { resolveIdentificationRedirectUrl } from './resolve-identification-redirect-url';
import { resolveTenantIdentificationConfig } from './resolve-tenant-identification-config';

/**
 * Orquesta la salida externa del carril "Certificado Digital" (AC-01/AC-02).
 * Invocado desde `identify-methods.component.ts::selectMethod('certificate')`.
 * Fail-closed en cada paso: si algo falla, no navega y devuelve la razón
 * para que `IssuanceStartService.reportCannotContinue()` encienda el aviso
 * de EUD-162 — nunca lanza, nunca sustituye por un destino por defecto.
 */
@Injectable({ providedIn: 'root' })
export class IdentificationRedirectService {
  private readonly sessionStore = inject(IssuanceStartSessionStore);
  private readonly configSource = inject(TenantPortalConfigSource);
  private readonly externalNavigator = inject(ExternalNavigator);

  /** Guard de doble activación — mismo patrón que `IssuanceStartService._isStarting`. */
  private isRedirecting = false;

  /**
   * Devuelve `null` si la navegación se produjo (o ya estaba en curso); en
   * cualquier otro caso devuelve la razón sin navegar.
   */
  redirectToIdentification(): CannotContinueReason | null {
    if (this.isRedirecting) {
      return null;
    }

    // ES-07 — elegir "Certificado Digital" sin arranque en el contexto: no
    // hay nada con lo que correlacionar un retorno futuro, no se fabrica
    // un arranque implícito.
    const session = this.sessionStore.read();
    if (!session) {
      return CannotContinueReason.StartSessionAbsent;
    }

    // ES-01/ES-02 — destino no admitido o config ausente: fail-closed, sin
    // sustituir por un valor por defecto (AD-5).
    const configResult = resolveTenantIdentificationConfig(session.tenant, this.configSource);
    if (!configResult.ok) {
      return CannotContinueReason.IdentificationConfigInvalid;
    }

    this.isRedirecting = true;
    const token = createCorrelationToken();
    const redirectedAt = Date.now();
    const updated: IssuanceStartSession = {
      ...session,
      state: 'redirigida',
      redirectedAt,
      expiresAt: redirectedAt + ISSUANCE_START_SESSION_TTL_MS,
      correlationToken: token,
      redirectedMethod: 'certificate',
    };

    // AC-02 — la sesión se sella ANTES de navegar. ES-05 — si la escritura
    // falla, un retorno posterior no sería correlacionable: se aborta.
    const persisted = this.sessionStore.update(updated);
    if (!persisted) {
      this.isRedirecting = false;
      return CannotContinueReason.Unknown;
    }

    const url = resolveIdentificationRedirectUrl(configResult.config, token);
    this.externalNavigator.redirect(url);
    return null;
  }
}
