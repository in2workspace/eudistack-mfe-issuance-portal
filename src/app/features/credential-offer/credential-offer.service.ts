import { Injectable, signal } from '@angular/core';
import { msUntilCredentialOfferExpiry } from './credential-offer-expiry';
import { CredentialOffer, WalletInvocationUrl } from './credential-offer.model';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';

export type CredentialOfferStatus = 'idle' | 'loading' | 'ready' | 'ready-without-qr' | 'unavailable';

/** Por encima de esta longitud, el QR no es fiable — degrada a 'ready-without-qr' (ES-06, NFR-U-163-01). */
export const MAX_QR_PAYLOAD_CHARS = 1200;

/**
 * Estado de presentación de la oferta en la pantalla QR (EUD-163): cargando,
 * lista, sin QR por longitud y no disponible, con la caducidad real de la
 * oferta. Ya no pide la oferta: la petición de la demo (`/api/bootstrap` con
 * los datos del titular desde el navegador) se retiró, y EUD-286 la pide al
 * servicio con `POST /journey/confirmation` y la presenta con `present()`.
 * La oferta vive solo en memoria (NFR-S-163-03).
 */
@Injectable({ providedIn: 'root' })
export class CredentialOfferService {
  private readonly _status = signal<CredentialOfferStatus>('idle');
  private readonly _offer = signal<CredentialOffer | null>(null);
  private readonly _walletInvocationUrl = signal<WalletInvocationUrl | null>(null);
  private readonly _cannotContinueReason = signal<CannotContinueReason | null>(null);

  readonly status = this._status.asReadonly();
  readonly offer = this._offer.asReadonly();
  readonly walletInvocationUrl = this._walletInvocationUrl.asReadonly();
  readonly cannotContinueReason = this._cannotContinueReason.asReadonly();

  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Presenta una oferta y arma su caducidad: al vencer, la retira y la marca como no disponible (ES-03). */
  present(offer: CredentialOffer, url: WalletInvocationUrl): void {
    this.clearExpiryTimer();
    this._offer.set(offer);
    this._walletInvocationUrl.set(url);
    this._cannotContinueReason.set(null);
    this._status.set(url.length > MAX_QR_PAYLOAD_CHARS ? 'ready-without-qr' : 'ready');
    this.expiryTimer = setTimeout(
      () => this.markUnavailable(CannotContinueReason.OfferUnavailable),
      Math.max(msUntilCredentialOfferExpiry(offer, Date.now()), 0),
    );
  }

  /** Retira la oferta presentada y muestra el aviso de no disponible. */
  markUnavailable(reason: CannotContinueReason): void {
    this.clearExpiryTimer();
    this._offer.set(null);
    this._walletInvocationUrl.set(null);
    this._cannotContinueReason.set(reason);
    this._status.set('unavailable');
  }

  /** Llamar desde `ngOnDestroy()` del componente consumidor — cancela el temporizador de caducidad pendiente. */
  cancelPendingWork(): void {
    this.clearExpiryTimer();
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
