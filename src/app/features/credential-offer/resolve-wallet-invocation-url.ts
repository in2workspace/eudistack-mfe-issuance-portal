export interface WalletInvocationUrl {
  url: string;
  length: number;
}

/**
 * Único cálculo que alimenta a la vez el QR y el enlace (AC-02 estructural,
 * no una comprobación separada). Absolutiza la ruta same-origin contra
 * `origin` — el QR lo escanea otro dispositivo, sin contexto de página — y
 * añade `credential_offer_uri=<reference>` (OID4VCI 1.0 §4/§4.1). El
 * esquema `openid-credential-offer://` ya es una URI completa y no se
 * absolutiza.
 */
export function resolveWalletInvocationUrl(
  reference: string,
  base: string,
  origin: string,
): WalletInvocationUrl {
  const absoluteBase = base.startsWith('/') ? `${origin}${base}` : base;
  const separator = absoluteBase.includes('?') ? '&' : '?';
  const url = `${absoluteBase}${separator}credential_offer_uri=${encodeURIComponent(reference)}`;
  return { url, length: url.length };
}
