(function(window) {
  window.env = window.env || {};

  // OIDC authorization endpoint (Verifier as IdP)
  window["env"]["oidc_authorization_endpoint"] = "https://cgcom.127.0.0.1.nip.io:4443/verifier/oidc/authorize";

  // OIDC client identifier for this portal
  window["env"]["oidc_client_id"] = "vc-auth-client-cgcom";

  // OIDC redirect URI for this portal
  window["env"]["oidc_portal_redirect_uri"] = "https://cgcom.127.0.0.1.nip.io:4443/issuance-portal/";

  // Issuance entry point configured for this tenant ('WITH_VALIDATION' | 'DIRECT')
  window["env"]["issuance_entry_point"] = "WITH_VALIDATION";

  // Downstream targets per entry point (EUD-3 / EUD-4). Empty = safe no-op.
  window["env"]["entry_point_target_with_validation"] = "";
  window["env"]["entry_point_target_direct"] = "";

  // EUD-163: destino de obtención de la oferta y base de invocación de wallet.
  window["env"]["credential_offer_url"] = "/issuance-portal/api/bootstrap";
  window["env"]["credential_offer_link_base"] = "/wallet/protocol/callback";

  // Dev/local tenant identity override (empty = resolve from subdomain).
  // Tenant branding/language assets are same-origin (/assets/tenants/{tenant}/theme.json,
  // nginx-mounted from eudistack-platform-assets) — no base URL config needed.
  window["env"]["tenant"] = "";
})(this);
