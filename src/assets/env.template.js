(function(window) {
  window.env = window.env || {};

  // Dev/local tenant identity override (empty = resolve from subdomain).
  // Tenant branding/language assets are same-origin (/assets/tenants/{tenant}/theme.json,
  // nginx-mounted from eudistack-platform-assets) — no base URL config needed.
  window["env"]["tenant"] = "${ISSUANCE_PORTAL_TENANT}";
})(this);
