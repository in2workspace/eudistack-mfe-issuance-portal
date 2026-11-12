import { LogLevel, OpenIdConfiguration } from 'angular-auth-oidc-client';

/** Ruta, bajo la base `/issuance-portal/`, a la que vuelve el Verifier (design.md §3.1, punto 2). */
export const LOGIN_CALLBACK_PATH = 'callback';

/** Nivel de garantía que el portal exige al Verifier (EUD-23 design.md §3.1, punto 1). */
export const REQUIRED_ACR = 'http://eidas.europa.eu/LoA/high';

const PORTAL_BASE_PATH = '/issuance-portal';

/**
 * Configuración del cliente OIDC público del Verifier del tenant (design.md
 * AD-6): código de autorización con PKCE `S256`, `state` y `nonce` que genera
 * la librería, y `acr` de nivel alto como claim esencial del ID Token.
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
    customParamsAuthRequest: {
      claims: JSON.stringify({ id_token: { acr: { essential: true, value: REQUIRED_ACR } } }),
    },
    useRefreshToken: true,
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
