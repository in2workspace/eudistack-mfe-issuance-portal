import { Injectable, inject, signal } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';
import { OidcFlowStorage } from './oidc-flow-storage';

/** Resultado de procesar la vuelta del Verifier. */
export type LoginOutcome = 'authenticated' | 'interaction-required' | 'failed';

/** Errores con los que el Verifier dice que un login sin interacción (`prompt=none`) no puede resolverse solo (OIDC Core 3.1.2.6). */
const INTERACTION_ERRORS: readonly string[] = ['login_required', 'interaction_required'];

/** Ventana en la que una renovación fallida puede llevar al Verifier una sola vez (W4). */
export const REDIRECT_WINDOW_MS = 60_000;

/** Si `authorize` no ha sacado la página del portal pasado este tiempo, se da por fallido y se permite otra ida. */
const REDIRECT_PENDING_MS = 10_000;

/** Margen con el que un Access Token se da por caducado antes de enviarlo, por el desfase de relojes. */
const EXPIRY_MARGIN_SECONDS = 5;

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
  private renewal: Promise<boolean> | null = null;
  private redirecting = false;

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
   * Descarta la sesión y lleva al titular al Verifier cuando no se pudo
   * renovar el Access Token (design.md §3.1, punto 5). Varias peticiones
   * pueden fallar a la vez y cada `authorize` guarda su propio verificador
   * PKCE: solo el primero sale hacia el Verifier. A la vuelta, `POST /journey`
   * devuelve el recorrido que ya existe. Como mucho una ida por ventana de
   * `REDIRECT_WINDOW_MS`, con una marca de tiempo en `sessionStorage` que
   * borra `confirmSession` o `discard`: si tras volver sigue el 401, no hay
   * otra ida y devuelve `false`, con la sesión descartada (W4). También
   * `false` si `authorize` falla.
   */
  redirectToVerifier(): boolean {
    if (this.redirecting) {
      return true;
    }
    const last = this.storage.readRedirectMark();
    if (last !== null && Date.now() - last < REDIRECT_WINDOW_MS) {
      this.discard();
      return false;
    }
    this.redirecting = true;
    this.clearSession();
    this.storage.writeRedirectMark(Date.now());
    try {
      this.login();
    } catch {
      this.redirecting = false;
      this.discard();
      return false;
    }
    // `authorize` falla de forma asíncrona sin avisar: si la página sigue aquí, se permite otra ida.
    setTimeout(() => (this.redirecting = false), REDIRECT_PENDING_MS);
    return true;
  }

  /** Una llamada al servicio ha tenido éxito con el token vigente: la ida por renovación ya no cuenta. */
  confirmSession(): void {
    this.storage.clearRedirectMark();
  }

  /**
   * Intenta el login sin interacción (`prompt=none`) con la sesión SSO del
   * Verifier: es lo que se hace al recargar, cuando se pierden los tokens
   * (design.md §3.1, punto 6). Si el Verifier no puede resolverlo solo, vuelve
   * con `login_required` o `interaction_required` y `completeLogin` lo dice.
   */
  loginSilently(): void {
    this.oidc.authorize(undefined, { customParams: { prompt: 'none' } });
  }

  /** El Access Token ya ha caducado (o caduca en unos segundos). Sin `exp` legible no se da por caducado: lo dirá el servicio con un 401. */
  isAccessTokenExpired(): boolean {
    const exp = expiryOf(this.accessTokenState());
    return exp !== null && exp - EXPIRY_MARGIN_SECONDS <= Date.now() / 1000;
  }

  /**
   * Renueva el Access Token con el Refresh Token (design.md §3.1, punto 5).
   * Las peticiones que lo necesitan a la vez comparten una sola renovación,
   * porque el Refresh Token es de un solo uso. Devuelve `false` si no se
   * puede (Refresh Token perdido, caducado o rechazado). Las renovaciones
   * no traen identidad: se conserva el nombre del primer ID Token.
   */
  renew(): Promise<boolean> {
    this.renewal ??= this.refresh().finally(() => (this.renewal = null));
    return this.renewal;
  }

  /**
   * Procesa la vuelta del Verifier en `url`: canjea el código y valida
   * `state`, `nonce` y el ID Token. Sin tokens, `failed` si el Verifier vuelve
   * con un error o la validación falla (AC-03, ES-04), e `interaction-required`
   * si el login sin interacción no pudo resolverse (AC-07): un `authorize`
   * interactivo nunca devuelve esos dos errores.
   */
  async completeLogin(url: string): Promise<LoginOutcome> {
    try {
      const error = new URL(url).searchParams.get('error');
      if (error !== null) {
        this.discard();
        return INTERACTION_ERRORS.includes(error) ? 'interaction-required' : 'failed';
      }
      const result = await firstValueFrom(this.oidc.checkAuth(url));
      if (!result.isAuthenticated || !result.accessToken) {
        this.discard();
        return 'failed';
      }
      this.accessTokenState.set(result.accessToken);
      this.givenNameState.set(givenNameOf(result.userData));
      return 'authenticated';
    } catch {
      this.discard();
      return 'failed';
    } finally {
      this.storage.clearFlow();
    }
  }

  /** Descarta los tokens y el nombre del titular. No cierra su sesión en el Verifier. */
  discard(): void {
    this.clearSession();
    this.storage.clearRedirectMark();
  }

  private clearSession(): void {
    this.accessTokenState.set(null);
    this.givenNameState.set('');
    this.oidc.logoffLocal();
    this.storage.clear();
  }

  private async refresh(): Promise<boolean> {
    try {
      const result = await firstValueFrom(this.oidc.forceRefreshSession());
      if (!result.isAuthenticated || !result.accessToken) {
        return false;
      }
      this.accessTokenState.set(result.accessToken);
      return true;
    } catch {
      return false;
    }
  }
}

function givenNameOf(userData: unknown): string {
  const name = (userData as { given_name?: unknown } | null)?.given_name;
  return typeof name === 'string' ? name : '';
}

/** `exp` (segundos) del Access Token, que el Verifier emite como JWT; `null` si no se puede leer. */
function expiryOf(token: string | null): number | null {
  try {
    const payload = token?.split('.')[1];
    if (!payload) {
      return null;
    }
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}
