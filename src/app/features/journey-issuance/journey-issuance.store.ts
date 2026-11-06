import { Injectable, signal } from '@angular/core';

/** Llamada que pide la oferta: la confirmación con el correo o un código nuevo. */
export type OfferCall = 'confirmation' | 'offers';

/**
 * Lo que la interfaz necesita recordar entre Datos, QR y la pantalla de
 * error para pedir la oferta (EUD-286): el correo que ha escrito el titular
 * y qué llamada hay que hacer o repetir. Solo en memoria (design.md AD-3):
 * recargar la página lo pierde, y entonces QR sin oferta vuelve a Datos
 * (ac.md EC-03).
 */
@Injectable({ providedIn: 'root' })
export class JourneyIssuanceStore {
  private readonly _email = signal<string | null>(null);
  private readonly _pendingCall = signal<OfferCall | null>(null);
  private readonly _emailRejected = signal(false);

  /** Correo con el que se pide la confirmación; también el de la cuenta del wallet. */
  readonly email = this._email.asReadonly();
  /** Llamada que QR (generando) tiene que hacer al entrar. */
  readonly pendingCall = this._pendingCall.asReadonly();
  /** El servicio ha rechazado el correo (400): Datos lo marca como no válido (ac.md ES-04). */
  readonly emailRejected = this._emailRejected.asReadonly();

  /** El titular confirma sus datos en Datos: QR pedirá la confirmación con este correo. */
  confirm(email: string): void {
    this._email.set(email);
    this._emailRejected.set(false);
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

  /** El servicio ha rechazado el correo: Datos lo muestra marcado. */
  rejectEmail(): void {
    this._emailRejected.set(true);
    this._pendingCall.set(null);
  }

  /** El recorrido acaba: no queda nada del titular en memoria. */
  clear(): void {
    this._email.set(null);
    this._pendingCall.set(null);
    this._emailRejected.set(false);
  }
}
