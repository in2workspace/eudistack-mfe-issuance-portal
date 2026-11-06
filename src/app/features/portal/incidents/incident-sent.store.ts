import { Injectable } from '@angular/core';

/**
 * Plazo de respuesta que devuelve `POST /incidents`, solo en memoria y para
 * una única visita a Ayuda enviada (`ac.md` decisión 8). No va en el estado
 * de la navegación: el router lo restaura de `history.state` al recargar y al
 * ir atrás y adelante.
 */
@Injectable({ providedIn: 'root' })
export class IncidentSentStore {
  private responseTime: string | null = null;

  set(responseTime: string): void {
    this.responseTime = responseTime;
  }

  has(): boolean {
    return this.responseTime !== null;
  }

  /** Devuelve el plazo y lo olvida, para que volver a la ruta lleve a Inicio. */
  take(): string {
    const responseTime = this.responseTime ?? '';
    this.responseTime = null;
    return responseTime;
  }
}
