import { Injectable } from '@angular/core';
import { IssuanceStartSession } from './issuance-start-session.model';

const SESSION_KEY_ISSUANCE_START = 'issuance_start_session';

/**
 * Crea y persiste la sesión de arranque del titular (SRS §7, AD-3).
 *
 * `sessionStorage` fail-closed: si la escritura falla, `create()` devuelve
 * `null` sin lanzar, de modo que `IssuanceStartService` pueda forzar el
 * estado "no se puede continuar" en lugar de navegar sin sesión correlacionable.
 */
@Injectable({ providedIn: 'root' })
export class IssuanceStartSessionStore {
  create(tenant: string): IssuanceStartSession | null {
    const session: IssuanceStartSession = {
      id: this.generarId(),
      tenant,
      state: 'iniciada',
    };

    try {
      sessionStorage.setItem(SESSION_KEY_ISSUANCE_START, JSON.stringify(session));
    } catch (err) {
      console.error(
        '[EUD-162] Error al escribir en sessionStorage. Sesión de arranque no creada.',
        err,
      );
      return null;
    }

    return session;
  }

  /** Genera un identificador de arranque único: 16 bytes aleatorios en Base64 URL-safe. */
  private generarId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
