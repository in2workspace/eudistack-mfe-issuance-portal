export const environment = {
  production: true,
  certIdentifierUrl: window["env"]["cert_identifier_url"],
  issuanceStartUrl: window["env"]["issuance_start_url"],
  bootstrapApiUrl: window["env"]["bootstrap_api_url"],
  walletCallbackBase: window["env"]["wallet_callback_base"],
  oidcAuthorizationEndpoint: window["env"]["oidc_authorization_endpoint"],
  oidcClientId: window["env"]["oidc_client_id"],
  oidcPortalRedirectUri: window["env"]["oidc_portal_redirect_uri"],
};
