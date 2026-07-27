export const environment = {
  production: false,
  walletCallbackBase: 'https://cgcom.127.0.0.1.nip.io:4443/wallet/protocol/callback',
  oidcAuthorizationEndpoint: 'https://cgcom.127.0.0.1.nip.io:4443/verifier/oidc/authorize',
  oidcClientId: 'vc-auth-client-cgcom',
  oidcPortalRedirectUri: 'https://cgcom.127.0.0.1.nip.io:4443/identify/portal',
  issuanceEntryPoint: 'WITH_VALIDATION',
  entryPointTargetWithValidation: '',
  entryPointTargetDirect: '',
  // Override de identidad de tenant para dev/local (AD-3). Vacío = resolver desde el subdominio.
  tenant: '',
};
