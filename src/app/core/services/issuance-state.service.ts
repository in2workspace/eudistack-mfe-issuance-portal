import { Injectable, signal } from '@angular/core';
import { AuthenticatedUser } from '../models/issuance.model';
import { environment } from '../../../environments/environment';

/**
 * Estado compartido entre rutas del flujo de emisión CGCOM.
 *
 * Equivalente Angular del estado local de App.tsx (React).
 * Usa signals (Angular 19) para reactividad sin Zone.js overhead.
 */
@Injectable({ providedIn: 'root' })
export class IssuanceStateService {
  readonly authenticatedUser = signal<AuthenticatedUser | null>(null);
  readonly credentialOfferUrl = signal<string | null>(null);
  readonly bootstrapLoading = signal(false);
  readonly bootstrapError = signal<string | null>(null);

  /**
   * URL del Portal de Identificación con certificado FNMT.
   * Placeholder de paridad con la demo (EUDISTACK-621/622).
   */
  readonly certIdentifierUrl = environment.certIdentifierUrl;

  setUser(user: AuthenticatedUser): void {
    this.authenticatedUser.set(user);
  }

  clearUser(): void {
    this.authenticatedUser.set(null);
    this.credentialOfferUrl.set(null);
    this.bootstrapError.set(null);
  }

  setCredentialOfferUrl(url: string): void {
    this.credentialOfferUrl.set(url);
  }

  setBootstrapLoading(loading: boolean): void {
    this.bootstrapLoading.set(loading);
  }

  setBootstrapError(error: string | null): void {
    this.bootstrapError.set(error);
  }
}
