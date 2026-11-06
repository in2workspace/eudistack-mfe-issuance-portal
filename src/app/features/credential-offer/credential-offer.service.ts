import { Injectable, signal } from '@angular/core';
import { isOfferAddressExpired, secondsUntilExpiry } from './credential-offer-expiry';
import { OfferAddress } from './credential-offer.model';

/**
 * Estados de la pantalla QR (wireframes, QR): generando, listo, sin QR y
 * caducado. El alta no preparada y los errores de emisión no son estados de
 * esta pantalla: llevan a la pantalla de error (EUD-287).
 */
export type CredentialOfferStatus = 'loading' | 'ready' | 'ready-without-qr' | 'expired';

/** Por encima de esta longitud el QR no es fiable: se muestra sin QR (ac.md AC-05). */
export const MAX_QR_PAYLOAD_CHARS = 1200;

const TICK_MS = 1000;

/**
 * Presentación de la dirección del QR con su cuenta atrás (EUD-286). La
 * cuenta atrás va hasta la caducidad que da el servicio y se recalcula con el
 * reloj en cada segundo, para no desviarse si el navegador retrasa el
 * temporizador. Al llegar a cero, la dirección se conserva para atenuar el
 * QR y la pantalla ofrece un código nuevo. Solo en memoria (design.md AD-3).
 */
@Injectable({ providedIn: 'root' })
export class CredentialOfferService {
  private readonly _status = signal<CredentialOfferStatus>('loading');
  private readonly _address = signal<OfferAddress | null>(null);
  private readonly _remainingSeconds = signal(0);

  readonly status = this._status.asReadonly();
  readonly address = this._address.asReadonly();
  readonly remainingSeconds = this._remainingSeconds.asReadonly();

  private ticker: ReturnType<typeof setInterval> | null = null;

  /** QR (generando): mientras se pide la oferta. */
  startLoading(): void {
    this.stopTicker();
    this._address.set(null);
    this._remainingSeconds.set(0);
    this._status.set('loading');
  }

  /** Presenta una dirección y arranca su cuenta atrás. Si ya ha caducado, entra caducada (ac.md EC-06). */
  present(address: OfferAddress): void {
    this.stopTicker();
    this._address.set(address);
    this._status.set(address.url.length > MAX_QR_PAYLOAD_CHARS ? 'ready-without-qr' : 'ready');
    if (!this.refresh()) {
      this.ticker = setInterval(() => this.refresh(), TICK_MS);
    }
  }

  /**
   * Al salir de QR, por cualquier motivo: para la cuenta atrás y olvida la
   * dirección, que lleva el ticket de alta o el enlace de la oferta. Volver a
   * QR siempre empieza generando (review W5; design.md AD-3).
   */
  reset(): void {
    this.stopTicker();
    this._address.set(null);
    this._remainingSeconds.set(0);
    this._status.set('loading');
  }

  /** Recalcula lo que queda; devuelve `true` si la dirección ha caducado. */
  private refresh(): boolean {
    const address = this._address();
    if (!address) {
      return true;
    }
    this._remainingSeconds.set(secondsUntilExpiry(address, Date.now()));
    if (isOfferAddressExpired(address, Date.now())) {
      this.stopTicker();
      this._status.set('expired');
      return true;
    }
    return false;
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
