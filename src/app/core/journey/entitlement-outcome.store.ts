import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Request as SourceRequest } from '../api/generated/authentic-source';

/**
 * Lo que Comprobación deja a la pantalla a la que lleva cuando la fuente no
 * confirma ninguna solicitud: ninguna solicitud (Sin solicitudes) o la única
 * solicitud no disponible o varias, ninguna disponible, con sus datos (Tus datos
 * no coinciden).
 */
export type EntitlementOutcome = { kind: 'no-requests' } | { kind: 'request-unavailable'; requests: SourceRequest[] };

/**
 * Respuesta de Fuente auténtica que Comprobación guarda en memoria solo
 * mientras esas dos pantallas la muestran (design.md §3.5, punto 1). Nada
 * va al navegador (AD-3): recargar la página la pierde y las dos pantallas
 * llevan entonces a Inicio.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementOutcomeStore {
  private readonly _outcome = signal<EntitlementOutcome | null>(null);

  readonly outcome = this._outcome.asReadonly();

  hold(outcome: EntitlementOutcome): void {
    this._outcome.set(outcome);
  }

  clear(): void {
    this._outcome.set(null);
  }
}

/**
 * Guarda de las pantallas que muestran lo que hay en memoria (design.md
 * AD-8): sin ello, por ejemplo tras recargar la página, llevan a Inicio.
 */
export function heldOutcomeGuard(kind: EntitlementOutcome['kind']): CanActivateFn {
  return () => (inject(EntitlementOutcomeStore).outcome()?.kind === kind ? true : inject(Router).createUrlTree(['/']));
}
