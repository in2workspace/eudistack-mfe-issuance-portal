export const environment = {
  production: true,
  certIdentifierUrl: window["env"]["cert_identifier_url"],
  bootstrapApiUrl: window["env"]["bootstrap_api_url"],
  walletCallbackBase: window["env"]["wallet_callback_base"],
  oidcAuthorizationEndpoint: window["env"]["oidc_authorization_endpoint"],
  oidcClientId: window["env"]["oidc_client_id"],
  oidcPortalRedirectUri: window["env"]["oidc_portal_redirect_uri"],
  issuanceEntryPoint: window["env"]["issuance_entry_point"] ?? '',
  entryPointTargetWithValidation: window["env"]["entry_point_target_with_validation"] ?? '',
  entryPointTargetDirect: window["env"]["entry_point_target_direct"] ?? '',
};
