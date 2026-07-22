export const environment = {
  production: false,
  certIdentifierUrl: 'https://cgcom.127.0.0.1.nip.io:4443/cert',
  bootstrapApiUrl: 'https://cgcom.127.0.0.1.nip.io:4443/identify/api/bootstrap',
  walletCallbackBase: 'https://cgcom.127.0.0.1.nip.io:4443/wallet/protocol/callback',
  oidcAuthorizationEndpoint: 'https://cgcom.127.0.0.1.nip.io:4443/verifier/oidc/authorize',
  oidcClientId: 'vc-auth-client-cgcom',
  oidcPortalRedirectUri: 'https://cgcom.127.0.0.1.nip.io:4443/identify/portal',
  issuanceEntryPoint: 'WITH_VALIDATION',
  entryPointTargetWithValidation: '',
  entryPointTargetDirect: '',
};
