export const environment = {
  production: true,
  oidcAuthorizationEndpoint: window["env"]["oidc_authorization_endpoint"],
  oidcClientId: window["env"]["oidc_client_id"],
  oidcPortalRedirectUri: window["env"]["oidc_portal_redirect_uri"],
  issuanceEntryPoint: window["env"]["issuance_entry_point"] ?? '',
  entryPointTargetWithValidation: window["env"]["entry_point_target_with_validation"] ?? '',
  entryPointTargetDirect: window["env"]["entry_point_target_direct"] ?? '',
  tenant: window["env"]["tenant"],
};
