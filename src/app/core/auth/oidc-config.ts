import { LogLevel, OpenIdConfiguration } from 'angular-auth-oidc-client';

/** Ruta, bajo la base `/issuance-portal/`, a la que vuelve el Verifier (design.md §3.1, punto 2). */
export const LOGIN_CALLBACK_PATH = 'callback';

/** Nivel de garantía del inicio de sesión del tenant, `assurance_level` de `GET /config` (design.md AD-14). */
export type AssuranceLevel = 'high' | 'substantial';

/** Nivel que se pide si no hay configuración cargada. */
export const DEFAULT_ASSURANCE_LEVEL: AssuranceLevel = 'high';

/** `acr` de eIDAS de cada nivel. */
export const ACR_BY_LEVEL: Readonly<Record<AssuranceLevel, string>> = {
  high: 'http://eidas.europa.eu/LoA/high',
  substantial: 'http://eidas.europa.eu/LoA/substantial',
};

/**
 * Parámetro `claims` del `authorize`: el `acr` del nivel del tenant como claim
 * esencial del ID Token (EUD-23 design.md §3.1, punto 1; AD-14). Esencial: el
 * Verifier solo ofrece los métodos que lo alcanzan.
 */
export function acrClaims(level: AssuranceLevel): string {
  return JSON.stringify({ id_token: { acr: { essential: true, value: ACR_BY_LEVEL[level] } } });
}

const PORTAL_BASE_PATH = '/issuance-portal';

/**
 * Configuración del cliente OIDC público del Verifier del tenant (design.md
 * AD-6): código de autorización con PKCE `S256`, `state` y `nonce` que genera
 * la librería. El `acr` esencial no va aquí sino en cada `authorize`, porque
 * depende del nivel del tenant, que llega con la configuración del portal
 * (`HolderAuthService`, AD-14).
 *
 * La renovación es solo con el Refresh Token y la dispara el interceptor de
 * `HolderAuthService.renew`, no la librería: sin `silentRenew` ni
 * comprobación de sesión, no hay temporizadores ni iframes.
 */
export function buildOidcConfig(tenant: string, origin: string): OpenIdConfiguration {
  if (!tenant) {
    throw new Error('Cannot build the OIDC configuration: the tenant could not be resolved.');
  }
  return {
    configId: 'issuance-portal',
    authority: `${origin}/verifier`,
    clientId: `issuance-portal-${tenant}`,
    redirectUrl: `${origin}${PORTAL_BASE_PATH}/${LOGIN_CALLBACK_PATH}`,
    postLogoutRedirectUri: `${origin}${PORTAL_BASE_PATH}/`,
    responseType: 'code',
    scope: 'openid profile email personal_administrative_number',
    useRefreshToken: true,
    // La vuelta la lleva LoginCallbackComponent, que navega al paso del recorrido. Sin esto la librería
    // navega antes a `postLoginRoute` (`/`, Inicio) y el titular ve Inicio un momento.
    triggerAuthorizationResultEvent: true,
    // El ID Token dura 60 s y no decide si hay sesión: lo hace el Access Token.
    triggerRefreshWhenIdTokenExpired: false,
    // El ID Token de una renovación puede no traer el `nonce` de la ida.
    ignoreNonceAfterRefresh: true,
    autoUserInfo: false,
    historyCleanupOff: false,
    // El ID Token del Verifier dura 60 s: la ventana de `iat` tolera un reloj
    // del equipo desfasado por minutos, sin desactivar la comprobación.
    maxIdTokenIatOffsetAllowedInSeconds: 300,
    logLevel: LogLevel.Error,
  };
}
