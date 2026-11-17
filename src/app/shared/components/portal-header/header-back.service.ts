import { Injectable, signal } from '@angular/core';

/**
 * Botón de volver de la cabecera cuando su destino depende de la pantalla y no
 * de la ruta (wireframes: Correo mientras se espera el código, Datos con
 * varias solicitudes). La pantalla lo pone al mostrarse y lo quita al
 * destruirse; si hay uno, manda sobre `data.back` de la ruta.
 */
@Injectable({ providedIn: 'root' })
export class HeaderBackService {
  private readonly _action = signal<(() => void) | null>(null);

  readonly action = this._action.asReadonly();

  set(action: () => void): void {
    this._action.set(action);
  }

  clear(): void {
    this._action.set(null);
  }
}
