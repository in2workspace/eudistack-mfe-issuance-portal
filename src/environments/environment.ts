export const environment = {
  production: false,
  oidcAuthorizationEndpoint: 'https://cgcom.127.0.0.1.nip.io:4443/verifier/oidc/authorize',
  oidcClientId: 'vc-auth-client-cgcom',
  oidcPortalRedirectUri: 'https://cgcom.127.0.0.1.nip.io:4443/issuance-portal/',
  issuanceEntryPoint: 'WITH_VALIDATION',
  entryPointTargetWithValidation: '',
  entryPointTargetDirect: '',
  // EUD-163: destino de obtención de la oferta y base de invocación de
  // wallet. Valor Phase 1 corregido tras el rename de prefijo de esta
  // sesión (era /identify/api/bootstrap en la spec original de EUD-163,
  // ya no existe — ver delta reportado en la Story).
  credentialOfferUrl: '/issuance-portal/api/bootstrap',
  credentialOfferLinkBase: '/wallet/protocol/callback',
  // Override de identidad de tenant para dev/local (AD-3). Vacío = resolver desde el subdominio.
  tenant: '',
};
