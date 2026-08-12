import { Injectable, signal } from '@angular/core';
import { AuthenticatedUser } from '../models/issuance.model';

/**
 * Estado compartido entre rutas del flujo de emisión CGCOM.
 *
 * Equivalente Angular del estado local de App.tsx (React).
 * Usa signals (Angular 19) para reactividad sin Zone.js overhead.
 */
@Injectable({ providedIn: 'root' })
export class IssuanceStateService {
  readonly authenticatedUser = signal<AuthenticatedUser | null>(null);

  setUser(user: AuthenticatedUser): void {
    this.authenticatedUser.set(user);
  }

  clearUser(): void {
    this.authenticatedUser.set(null);
  }
}
