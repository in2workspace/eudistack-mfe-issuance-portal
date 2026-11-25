import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';
import { PortalConfigService } from '../config/portal-config.service';
import { AssuranceLevel, DEFAULT_ASSURANCE_LEVEL, acrClaims, withScope } from './oidc-config';
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
  private readonly portalConfig = inject(PortalConfigService);
  private readonly router = inject(Router);

  private readonly accessTokenState = signal<string | null>(null);
  private readonly givenNameState = signal('');
  private renewal: Promise<boolean> | null = null;
  private redirecting = false;

  constructor() {
    // Si el titular vuelve con «Atrás» y el navegador restaura esta página de su caché, la ida al Verifier no
    // ocurrió aquí: sin esto `redirecting` seguiría en `true` y las llamadas con 401 quedarían colgadas.
    window.addEventListener('pageshow', (event: PageTransitionEvent) => {
      if (event.persisted) {
        this.redirecting = false;
      }
    });
  }

  /** `given_name` del ID Token ya validado; vacío si el token no lo trae (EC-08). */
  readonly givenName = this.givenNameState.asReadonly();

  /** Access Token vigente, o `null` si el titular no se ha identificado. */
  accessToken(): string | null {
    return this.accessTokenState();
  }

  /**
   * Lleva al titular al `authorize` del Verifier, pidiendo como esencial el nivel del tenant (AD-14). Puede
   * resolverse con la sesión SSO del Verifier: es la ida del mismo titular a mitad del recorrido (renovación
   * fallida, o `prompt=none` sin resolver al recargar). `returnPath` es la ruta a la que volver (EUD-359, EC-06).
   */
  login(returnPath?: string): void {
    this.rememberReturnPath(returnPath);
    this.authorize({ claims: acrClaims(this.assuranceLevel()) });
  }

  /**
   * Como `login`, pero con `prompt=login`: el Verifier no reutiliza su sesión SSO y quien llega tiene que
   * identificarse. Es la ida de Empezar y de «Volver a intentarlo»: en un equipo compartido, quien pulse
   * Empezar después no entra con la identidad del titular anterior (EUD-23 design.md §3.1, punto 7; AC-08).
   */
  loginAgain(): void {
    this.authorize({ prompt: 'login', claims: acrClaims(this.assuranceLevel()) });
  }

  /**
   * Descarta la sesión y lleva al titular al Verifier cuando no se pudo
   * renovar el Access Token (design.md §3.1, punto 5). Varias peticiones
   * pueden fallar a la vez y cada `authorize` guarda su propio verificador
   * PKCE: solo el primero sale hacia el Verifier. A la vuelta, `POST /journey`
   * devuelve el recorrido que ya existe. Como mucho una ida por ventana de
   * `REDIRECT_WINDOW_MS`, con una marca de tiempo en `sessionStorage` (decisión
   * 9 de `ac.md`) que solo se borra cuando ha pasado la ventana o al descartar
   * la sesión: si tras volver sigue el 401, no hay otra ida y devuelve
   * `false`, con la sesión descartada (W4). También `false` si `authorize`
   * falla.
   */
  redirectToVerifier(): boolean {
    if (this.redirecting) {
      return true;
    }
    if (this.isInsideRedirectWindow()) {
      this.discard();
      return false;
    }
    this.redirecting = true;
    this.clearSession();
    this.storage.writeRedirectMark(Date.now());
    try {
      // La ruta actual, para volver a la misma solicitud con los tokens nuevos (AC-23, EC-06).
      this.login(this.router.url);
    } catch {
      this.redirecting = false;
      this.discard();
      return false;
    }
    this.watchPendingRedirect();
    return true;
  }

  /**
   * Una llamada al servicio ha tenido éxito: borra la marca de la última ida
   * solo si ya ha pasado su ventana. Un éxito de otro endpoint no la borra
   * antes, para que un 401 que se repite no lleve al Verifier en cada página
   * (N1 de la ronda 2).
   */
  confirmSession(): void {
    if (!this.isInsideRedirectWindow()) {
      this.storage.clearRedirectMark();
    }
  }

  /**
   * Intenta el login sin interacción (`prompt=none`) con la sesión SSO del
   * Verifier: es lo que se hace al recargar, cuando se pierden los tokens
   * (design.md §3.1, punto 6). Si el Verifier no puede resolverlo solo, vuelve
   * con `login_required` o `interaction_required` y `completeLogin` lo dice.
   */
  loginSilently(returnPath?: string): void {
    this.rememberReturnPath(returnPath);
    this.authorize({ prompt: 'none', claims: acrClaims(this.assuranceLevel()) });
  }

  /** La ruta a la que volver tras la vuelta del Verifier (EC-06), si se guardó una; se lee una sola vez. */
  takeReturnPath(): string | null {
    return this.storage.takeReturnPath();
  }

  private rememberReturnPath(path: string | undefined): void {
    if (path) {
      this.storage.writeReturnPath(path);
    }
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
      // El descubrimiento del Verifier (`token_endpoint`, `jwks_uri`) vive en el
      // almacenamiento en memoria y no sobrevive a la ida al Verifier: sin él,
      // `checkAuth` no canjea el código. Se vuelve a cargar antes.
      await firstValueFrom(this.oidc.preloadAuthWellKnownDocument());
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

  /** Lleva el navegador a `url`, la del `authorize` ya completa. */
  navigateTo(url: string): void {
    window.location.href = url;
  }

  /**
   * `authorize` con `customParams` y, en el `scope`, el de la atestación de
   * login del tenant si la configuración lo trae (AD-15): así el Verifier
   * ofrece también la cartera.
   */
  private authorize(customParams: Record<string, string>): void {
    const scope = this.portalConfig.config()?.login_attestation_scope;
    this.oidc.authorize(undefined, { customParams, urlHandler: (url) => this.navigateTo(withScope(url, scope)) });
  }

  /** Nivel del tenant de la configuración cargada; alto si aún no hay configuración. */
  private assuranceLevel(): AssuranceLevel {
    return this.portalConfig.config()?.assurance_level === 'substantial' ? 'substantial' : DEFAULT_ASSURANCE_LEVEL;
  }

  private isInsideRedirectWindow(): boolean {
    const last = this.storage.readRedirectMark();
    if (last === null) {
      return false;
    }
    // Una marca en el futuro (el reloj del equipo ha retrocedido) no abre la ventana.
    const elapsed = Date.now() - last;
    return elapsed >= 0 && elapsed < REDIRECT_WINDOW_MS;
  }

  /**
   * `authorize` falla de forma asíncrona sin avisar: si la página sigue aquí
   * pasado `REDIRECT_PENDING_MS`, se permite otra ida. En cuanto el navegador
   * empieza a salir hacia el Verifier (`beforeunload`), el temporizador se
   * anula: un Verifier lento no debe dejar que otro 401 enseñe la pantalla de
   * error mientras la página se va (N2 de la ronda 2).
   */
  private watchPendingRedirect(): void {
    const leaving = (): void => clearTimeout(timer);
    const timer = setTimeout(() => {
      window.removeEventListener('beforeunload', leaving);
      this.redirecting = false;
    }, REDIRECT_PENDING_MS);
    window.addEventListener('beforeunload', leaving, { once: true });
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
