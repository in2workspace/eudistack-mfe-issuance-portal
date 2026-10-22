(function(window) {
  window.env = window.env || {};

  // EUD-163: destino de obtención de la oferta y base de invocación de wallet.
  window["env"]["credential_offer_url"] = "${CREDENTIAL_OFFER_URL}";
  window["env"]["credential_offer_link_base"] = "${CREDENTIAL_OFFER_LINK_BASE}";

  // EUD-164: destino de identificación del carril "Certificado Digital" +
  // modo de correlación del retorno ('echo' | 'same_context'). Sin estas
  // variables el carril no redirige (fail-closed, AD-5/R-6).
  window["env"]["identification_url"] = "${IDENTIFICATION_URL}";
  window["env"]["identification_correlation_mode"] = "${IDENTIFICATION_CORRELATION_MODE}";
  window["env"]["identification_correlation_param"] = "${IDENTIFICATION_CORRELATION_PARAM}";

  // Dev/local tenant identity override (empty = resolve from subdomain).
  // Tenant branding/language assets are same-origin (/assets/tenants/{tenant}/theme.json,
  // nginx-mounted from eudistack-platform-assets) — no base URL config needed.
  window["env"]["tenant"] = "${ISSUANCE_PORTAL_TENANT}";
})(this);
