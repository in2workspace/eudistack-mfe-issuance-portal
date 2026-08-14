import { Injectable } from '@angular/core';

/**
 * Único punto de la app que sale del origen del portal (EUD-164).
 * `IdentificationRedirectService` es su único consumidor — envolverlo en un
 * servicio inyectable permite sustituirlo por un mock en tests sin
 * manipular `window.location` en jsdom.
 *
 * EUD-162 documentó este seam ("punto de sustitución para EUD-164") pero
 * nunca llegó a implementarlo — las salidas reales seguían asignando
 * `window.location.href` directamente. Esta Story lo crea.
 */
@Injectable({ providedIn: 'root' })
export class ExternalNavigator {
  redirect(url: string): void {
    window.location.href = url;
  }
}
