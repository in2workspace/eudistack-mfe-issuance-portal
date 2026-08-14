import { Injectable } from '@angular/core';
import type { IssuanceStartSession } from './issuance-start-session.model';

const STORAGE_KEY = 'issuance_start_session';

@Injectable({ providedIn: 'root' })
export class IssuanceStartSessionStore {
  /**
   * Persiste la sesión. Devuelve `false` sin lanzar si `sessionStorage` no está
   * disponible o la escritura falla (p.ej. cuota excedida en modo privado),
   * de modo que el caller (`IssuanceStartService`, AC-02/ES-03) pueda decidir
   * si necesita fail-closed. `IssuanceEntryPointService` (EUD-165) no depende
   * de este valor de retorno: solo consume `read()`.
   */
  create(session: IssuanceStartSession): boolean {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return true;
    } catch {
      return false;
    }
  }

  read(): IssuanceStartSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as IssuanceStartSession) : null;
    } catch {
      // Intentionally ignored: an inaccessible storage or corrupt JSON is treated
      // as "no session" (returns null), not a failure. The tenant resolver then
      // falls back to the runtime config source (EC-01).
      return null;
    }
  }

  /**
   * Sella una transición de estado sobre la sesión existente (EUD-164:
   * `redirigida`/`retomada` + sus campos de correlación). Devuelve `false`
   * sin lanzar en el mismo caso que `create()` — el caller (`Identification
   * RedirectService`/`IdentificationReturnService`) decide el fail-closed
   * correspondiente (ES-05).
   */
  update(session: IssuanceStartSession): boolean {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return true;
    } catch {
      return false;
    }
  }

  /** Descarta la sesión de arranque actual — usado por `retry()` (AC-06). */
  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore — la ausencia de sesión no es distinguible de un clear fallido
    }
  }
}