import { Injectable, signal } from '@angular/core';

/**
 * Flecha de volver junto a «Paso X de 3» (wireframes: Correo mientras se
 * espera el código, Datos con varias solicitudes). Su destino depende de la
 * pantalla, así que la pantalla la pone al mostrarse y la quita al destruirse.
 */
@Injectable({ providedIn: 'root' })
export class StepBackService {
  private readonly _action = signal<(() => void) | null>(null);

  readonly action = this._action.asReadonly();

  set(action: () => void): void {
    this._action.set(action);
  }

  clear(): void {
    this._action.set(null);
  }
}
