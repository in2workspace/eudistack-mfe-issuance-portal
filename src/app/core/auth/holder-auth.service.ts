import { Injectable, inject, signal } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';
import { OidcFlowStorage } from './oidc-flow-storage';

/**
 * Sesión del titular con el Verifier (design.md §3.1, AD-6, AD-13). Los
 * tokens y el nombre viven solo en memoria: aquí, en señales, y en el
 * almacenamiento en memoria de la librería. `discard()` los borra de los dos.
 */
@Injectable({ providedIn: 'root' })
export class HolderAuthService {
  private readonly oidc = inject(OidcSecurityService);
  private readonly storage = inject(OidcFlowStorage);

  private readonly accessTokenState = signal<string | null>(null);
  private readonly givenNameState = signal('');

  /** `given_name` del ID Token ya validado; vacío si el token no lo trae (EC-08). */
  readonly givenName = this.givenNameState.asReadonly();

  /** Access Token vigente, o `null` si el titular no se ha identificado. */
  accessToken(): string | null {
    return this.accessTokenState();
  }

  /** Lleva al titular al `authorize` del Verifier. */
  login(): void {
    this.oidc.authorize();
  }

  /**
   * Procesa la vuelta del Verifier en `url`: canjea el código y valida
   * `state`, `nonce` y el ID Token. Devuelve `false`, sin tokens, si el
   * Verifier vuelve con un error o la validación falla (AC-03, ES-04).
   */
  async completeLogin(url: string): Promise<boolean> {
    try {
      if (new URL(url).searchParams.has('error')) {
        this.discard();
        return false;
      }
      const result = await firstValueFrom(this.oidc.checkAuth(url));
      if (!result.isAuthenticated || !result.accessToken) {
        this.discard();
        return false;
      }
      this.accessTokenState.set(result.accessToken);
      this.givenNameState.set(givenNameOf(result.userData));
      return true;
    } catch {
      this.discard();
      return false;
    } finally {
      this.storage.clearFlow();
    }
  }

  /** Descarta los tokens y el nombre del titular. No cierra su sesión en el Verifier. */
  discard(): void {
    this.accessTokenState.set(null);
    this.givenNameState.set('');
    this.oidc.logoffLocal();
    this.storage.clear();
  }
}

function givenNameOf(userData: unknown): string {
  const name = (userData as { given_name?: unknown } | null)?.given_name;
  return typeof name === 'string' ? name : '';
}
