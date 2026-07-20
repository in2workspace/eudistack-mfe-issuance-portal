import { Injectable } from '@angular/core';
import type { IssuanceStartSession } from './issuance-start-session.model';

const STORAGE_KEY = 'issuance_start_session';

@Injectable({ providedIn: 'root' })
export class IssuanceStartSessionStore {
  create(session: IssuanceStartSession): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
    }
  }

  read(): IssuanceStartSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as IssuanceStartSession) : null;
    } catch {
      return null;
    }
  }
}
