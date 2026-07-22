(function(window) {
  window.env = window.env || {};

  // CGCOM cert identifier service endpoint
  window["env"]["cert_identifier_url"] = "${CERT_IDENTIFIER_URL}";

  // CGCOM bootstrap API endpoint
  window["env"]["bootstrap_api_url"] = "${BOOTSTRAP_API_URL}";

  // Wallet protocol callback base URL
  window["env"]["wallet_callback_base"] = "${WALLET_CALLBACK_BASE}";

  // OIDC authorization endpoint (Verifier as IdP)
  window["env"]["oidc_authorization_endpoint"] = "${OIDC_AUTHORIZATION_ENDPOINT}";

  // OIDC client identifier for this portal
  window["env"]["oidc_client_id"] = "${OIDC_CLIENT_ID}";

  // OIDC redirect URI for this portal
  window["env"]["oidc_portal_redirect_uri"] = "${OIDC_PORTAL_REDIRECT_URI}";

  // Issuance entry point configured for this tenant ('WITH_VALIDATION' | 'DIRECT')
  window["env"]["issuance_entry_point"] = "${ISSUANCE_ENTRY_POINT}";

  // Downstream targets per entry point (EUD-3 / EUD-4). Empty = safe no-op.
  window["env"]["entry_point_target_with_validation"] = "${ENTRY_POINT_TARGET_WITH_VALIDATION}";
  window["env"]["entry_point_target_direct"] = "${ENTRY_POINT_TARGET_DIRECT}";
})(this);
