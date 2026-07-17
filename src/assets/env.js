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

  // Issuance entry point configured for this tenant ('WITH_VALIDATION' | 'DIRECT')
  window["env"]["issuance_entry_point"] = "WITH_VALIDATION";

  // Downstream targets per entry point (EUD-3 / EUD-4). Empty = safe no-op.
  window["env"]["entry_point_target_with_validation"] = "";
  window["env"]["entry_point_target_direct"] = "";

  // Shared assets repository base URL (tenant branding/language, SAD §8.8)
  window["env"]["assets_base_url"] = "https://assets.eudistack.net";

  // Dev/local tenant identity override (empty = resolve from subdomain)
  window["env"]["tenant"] = "";
})(this);
