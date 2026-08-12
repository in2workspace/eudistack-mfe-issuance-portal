(function(window) {
  window.env = window.env || {};

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

  // EUD-163: destino de obtención de la oferta y base de invocación de wallet.
  window["env"]["credential_offer_url"] = "${CREDENTIAL_OFFER_URL}";
  window["env"]["credential_offer_link_base"] = "${CREDENTIAL_OFFER_LINK_BASE}";

  // Dev/local tenant identity override (empty = resolve from subdomain).
  // Tenant branding/language assets are same-origin (/assets/tenants/{tenant}/theme.json,
  // nginx-mounted from eudistack-platform-assets) — no base URL config needed.
  window["env"]["tenant"] = "${ISSUANCE_PORTAL_TENANT}";
})(this);
