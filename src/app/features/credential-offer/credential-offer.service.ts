import { Injectable, inject, signal } from '@angular/core';
import { CredentialOfferSource, CredentialOfferRequestContext } from './credential-offer.source';
import { resolveCredentialOfferConfig } from './resolve-credential-offer-config';
import { resolveWalletInvocationUrl, WalletInvocationUrl } from './resolve-wallet-invocation-url';
import { msUntilCredentialOfferExpiry } from './credential-offer-expiry';
import { CredentialOffer, CredentialOfferFailureReason } from './credential-offer.model';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';
import { IssuanceStartSessionStore } from '../issuance-start/issuance-start-session.store';
import { TenantPortalConfigSource } from '../../core/config/tenant-portal-config.source';
import { resolveTenantIdentity } from '../../core/branding/resolve-tenant-identity';
import { environment } from '../../../environments/environment';

export type CredentialOfferStatus = 'idle' | 'loading' | 'ready' | 'ready-without-qr' | 'unavailable';

/** Por encima de esta longitud, el QR no es fiable — degrada a 'ready-without-qr' (ES-06, NFR-U-163-01). */
export const MAX_QR_PAYLOAD_CHARS = 1200;

/**
 * Orquesta la obtención y presentación de la oferta de credencial (EUD-163).
 *
 * Invariante "una sola oferta en presentación" (AC-07, AD-4): memoización en
 * memoria por clave de proceso (`session.id`, o `tenant:<tenant>` si no hay
 * sesión — EC-04), nunca persistida (NFR-S-163-03). Guard de single-flight
 * (EC-02) leído/escrito en el mismo turno síncrono. `requestId` monótono
 * hace determinista el last-request-wins ante respuestas tardías o
 * temporizadores de una petición ya cancelada por `retry()` (§3.4.1
 * W-2/W-3/W-4 del tech-design).
 */
@Injectable({ providedIn: 'root' })
export class CredentialOfferService {
  private readonly configSource = inject(TenantPortalConfigSource);
  private readonly sessionStore = inject(IssuanceStartSessionStore);
  private readonly source = inject(CredentialOfferSource);

  private readonly _status = signal<CredentialOfferStatus>('idle');
  private readonly _offer = signal<CredentialOffer | null>(null);
  private readonly _walletInvocationUrl = signal<WalletInvocationUrl | null>(null);
  private readonly _cannotContinueReason = signal<CannotContinueReason | null>(null);

  readonly status = this._status.asReadonly();
  readonly offer = this._offer.asReadonly();
  readonly walletInvocationUrl = this._walletInvocationUrl.asReadonly();
  readonly cannotContinueReason = this._cannotContinueReason.asReadonly();

  private inFlight = false;
  private currentRequestId = 0;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly resultByKey = new Map<string, { offer: CredentialOffer; url: WalletInvocationUrl }>();

  /** Solicita la oferta. No-op si ya hay una en vuelo (EC-02) o ya memoizada para este proceso (AC-07). */
  request(context: CredentialOfferRequestContext): void {
    const key = this.resolveProcessKey();

    const memoized = this.resultByKey.get(key);
    if (memoized) {
      this.publishReady(memoized.offer, memoized.url);
      return;
    }

    if (this.inFlight) {
      return;
    }

    const tenant = this.resolveTenant();
    const configResult = resolveCredentialOfferConfig(tenant, this.configSource);
    if (!configResult.ok) {
      this.fail(CannotContinueReason.OfferUnavailable);
      return; // ES-02: 0 llamadas de red.
    }

    this.inFlight = true;
    this._status.set('loading');
    const requestId = ++this.currentRequestId;

    this.source.fetch(configResult.config, context).subscribe((result) => {
      this.inFlight = false;
      if (requestId !== this.currentRequestId) {
        return; // W-2: respuesta de una petición ya cancelada por retry() — se descarta.
      }
      if (!result.ok) {
        this.fail(this.mapFailureReason(result.reason));
        return;
      }

      const url = resolveWalletInvocationUrl(
        result.offer.reference,
        configResult.config.walletInvocationBase,
        window.location.origin,
      );
      this.resultByKey.set(key, { offer: result.offer, url });
      this.publishReady(result.offer, url);
      this.armExpiryTimer(result.offer, key, requestId);
    });
  }

  /** Descarta la oferta/petición vigente y solicita una nueva (AC-06). */
  retry(context: CredentialOfferRequestContext): void {
    this.resultByKey.delete(this.resolveProcessKey());
    this.currentRequestId++; // W-3/W-4: invalida cualquier respuesta o temporizador en vuelo.
    this.clearExpiryTimer();
    this.inFlight = false;
    this._offer.set(null);
    this._walletInvocationUrl.set(null);
    this._cannotContinueReason.set(null);
    this._status.set('idle');
    this.request(context);
  }

  /** Llamar desde `ngOnDestroy()` del component consumidor — cancela el temporizador de caducidad pendiente. */
  cancelPendingWork(): void {
    this.clearExpiryTimer();
  }

  private publishReady(offer: CredentialOffer, url: WalletInvocationUrl): void {
    this._offer.set(offer);
    this._walletInvocationUrl.set(url);
    this._cannotContinueReason.set(null);
    this._status.set(url.length > MAX_QR_PAYLOAD_CHARS ? 'ready-without-qr' : 'ready');
  }

  private armExpiryTimer(offer: CredentialOffer, key: string, requestId: number): void {
    this.clearExpiryTimer();
    // Auditoría EUD-163 (code-reviewer, hallazgo B1): msRemaining se deriva
    // de `msUntilCredentialOfferExpiry` (mismo cálculo que usa
    // `isCredentialOfferExpired`, credential-offer-expiry.ts) en vez de
    // reimplementar la resta TTL/elapsed aquí — única fuente de verdad.
    const msRemaining = msUntilCredentialOfferExpiry(offer, Date.now());
    this.expiryTimer = setTimeout(() => {
      if (requestId !== this.currentRequestId) {
        return; // W-4: no-op si ya no es la petición vigente (recargado/reintentado).
      }
      this.resultByKey.delete(key);
      this.fail(CannotContinueReason.OfferUnavailable); // ES-03: la expiración usa el mismo aviso (decisión de PO 4).
    }, Math.max(msRemaining, 0));
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private fail(reason: CannotContinueReason): void {
    this._cannotContinueReason.set(reason);
    this._status.set('unavailable');
  }

  private mapFailureReason(reason: CredentialOfferFailureReason): CannotContinueReason {
    return reason === 'timeout' ? CannotContinueReason.OfferTimeout : CannotContinueReason.OfferUnavailable;
  }

  /** Clave de memoización por proceso (AC-07) — `session.id`, o `tenant:<tenant>` sin sesión (EC-04). */
  private resolveProcessKey(): string {
    const session = this.sessionStore.read();
    return session?.id ?? `tenant:${this.resolveTenant()}`;
  }

  private resolveTenant(): string {
    const session = this.sessionStore.read();
    return session?.tenant ?? resolveTenantIdentity(window.location, environment) ?? '';
  }
}
