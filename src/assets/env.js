(function(window) {
  window.env = window.env || {};

  // CGCOM cert identifier service endpoint
  window["env"]["cert_identifier_url"] = "https://cgcom.127.0.0.1.nip.io:4443/cert";

  // Issuance start destination (EUD-164 sets this once identification redirect is deployed; empty = safe no-op '#')
  window["env"]["issuance_start_url"] = "";

  // CGCOM bootstrap API endpoint
  window["env"]["bootstrap_api_url"] = "https://cgcom.127.0.0.1.nip.io:4443/identify/api/bootstrap";

  // Wallet protocol callback base URL
  window["env"]["wallet_callback_base"] = "https://cgcom.127.0.0.1.nip.io:4443/wallet/protocol/callback";

  // OIDC authorization endpoint (Verifier as IdP)
  window["env"]["oidc_authorization_endpoint"] = "https://cgcom.127.0.0.1.nip.io:4443/verifier/oidc/authorize";

  // OIDC client identifier for this portal
  window["env"]["oidc_client_id"] = "vc-auth-client-cgcom";

  // OIDC redirect URI for this portal
  window["env"]["oidc_portal_redirect_uri"] = "https://cgcom.127.0.0.1.nip.io:4443/identify/portal";
})(this);
