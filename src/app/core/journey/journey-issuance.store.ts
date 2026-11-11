import { Injectable, signal } from '@angular/core';

/** Llamada que pide la oferta: la confirmación o un código nuevo. */
export type OfferCall = 'confirmation' | 'offers';

/**
 * Lo que la interfaz necesita recordar entre QR y la pantalla de error para
 * pedir la oferta (EUD-286): qué llamada hay que hacer o repetir. El correo
 * no se guarda: lo verifica el servicio y la confirmación no lo recibe
 * (EUD-358). Solo en memoria (design.md AD-3): recargar la página lo pierde, y
 * entonces QR decide con lo que dice `GET /journey`.
 */
@Injectable({ providedIn: 'root' })
export class JourneyIssuanceStore {
  private readonly _pendingCall = signal<OfferCall | null>(null);

  /** Llamada que QR (generando) tiene que hacer al entrar. */
  readonly pendingCall = this._pendingCall.asReadonly();

  /** El correo está verificado: QR pedirá la confirmación. */
  requestConfirmation(): void {
    this._pendingCall.set('confirmation');
  }

  /** QR caducado o fallo de un código nuevo: QR pedirá un código nuevo. */
  requestNewOffer(): void {
    this._pendingCall.set('offers');
  }

  /** La oferta ha llegado: no queda ninguna llamada por hacer. */
  offerReceived(): void {
    this._pendingCall.set(null);
  }

  /** El recorrido acaba: no queda nada en memoria. */
  clear(): void {
    this._pendingCall.set(null);
  }
}
