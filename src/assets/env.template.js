(function(window) {
  window.env = window.env || {};

  // CGCOM cert identifier service endpoint
  window["env"]["cert_identifier_url"] = "${CERT_IDENTIFIER_URL}";

  // Issuance start destination (EUD-164 sets this once identification redirect is deployed; empty = safe no-op '#')
  window["env"]["issuance_start_url"] = "${ISSUANCE_START_URL}";

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
})(this);
