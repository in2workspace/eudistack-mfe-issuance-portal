import { Injectable, signal } from '@angular/core';

/** Llamada que pide la oferta: la confirmación o un código nuevo. */
export type OfferCall = 'confirmation' | 'offers';

/** La llamada que QR tiene que hacer o repetir, y para qué solicitud (design.md AD-9). */
export interface PendingOffer {
  call: OfferCall;
  /** Identificador opaco de la solicitud en el recorrido, el de la ruta de QR. */
  requestId: string;
}

/**
 * Lo que la interfaz necesita recordar entre QR y la pantalla de error para
 * pedir la oferta (EUD-286): qué llamada hay que hacer o repetir y para qué
 * solicitud. El correo no se guarda: lo verifica el servicio y la
 * confirmación no lo recibe (EUD-358). Solo en memoria (design.md AD-3):
 * recargar la página lo pierde, y entonces QR decide con lo que dice
 * `GET /journey`.
 */
@Injectable({ providedIn: 'root' })
export class JourneyIssuanceStore {
  private readonly _pending = signal<PendingOffer | null>(null);

  /** Llamada que QR (generando) tiene que hacer al entrar. */
  readonly pending = this._pending.asReadonly();

  /** QR pedirá la confirmación de la solicitud. */
  requestConfirmation(requestId: string): void {
    this._pending.set({ call: 'confirmation', requestId });
  }

  /** QR caducado o fallo de un código nuevo: QR pedirá un código nuevo de la solicitud. */
  requestNewOffer(requestId: string): void {
    this._pending.set({ call: 'offers', requestId });
  }

  /** La oferta ha llegado: no queda ninguna llamada por hacer. */
  offerReceived(): void {
    this._pending.set(null);
  }

  /** El recorrido acaba: no queda nada en memoria. */
  clear(): void {
    this._pending.set(null);
  }
}
