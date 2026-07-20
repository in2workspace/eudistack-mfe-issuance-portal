import { Injectable } from '@angular/core';
import type { IssuanceStartSession } from './issuance-start-session.model';

const STORAGE_KEY = 'issuance_start_session';

@Injectable({ providedIn: 'root' })
export class IssuanceStartSessionStore {
  create(session: IssuanceStartSession): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Intentionally ignored: if sessionStorage is disabled or the quota is
      // exceeded (e.g. Safari private mode), EUD-165 falls back to the default
      // return with no persisted session (EC-01). Not an error to propagate.
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
}
