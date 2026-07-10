import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Claves de sessionStorage para persistir valores PKCE entre solicitud y callback. */
const SESSION_KEY_CODE_VERIFIER = 'oidc_code_verifier';
const SESSION_KEY_STATE = 'oidc_state';

/**
 * Gestiona el flujo OIDC Authorization Code con PKCE para el portal ACME (HU-010).
 *
 * Porta la lógica inline de AcmeLandingPage.tsx (React) a un servicio Angular.
 * Todas las operaciones criptográficas usan Web Crypto API (RFC 7636).
 */
@Injectable({ providedIn: 'root' })
export class AcmeOidcService {
  private readonly authorizationEndpoint = environment.oidcAuthorizationEndpoint;
  private readonly clientId = environment.oidcClientId;
  private readonly redirectUri = environment.oidcPortalRedirectUri;
  private readonly scope = 'openid profile email offline_access doctorid role';

  /**
   * Inicia el flujo OIDC Authorization Code con PKCE (HU-010).
   *
   * Secuencia (RN-004, RN-007):
   * 1. Genera code_verifier (síncrono)
   * 2. Deriva code_challenge via SHA-256 (asíncrono)
   * 3. Genera state (síncrono)
   * 4. Escribe code_verifier y state en sessionStorage
   * 5. Construye URL de autorización
   * 6. Redirige el navegador en la misma pestaña
   */
  async iniciarFlujo(): Promise<void> {
    const codeVerifier = this.generarCodeVerifier();
    const codeChallenge = await this.derivarCodeChallenge(codeVerifier);
    const state = this.generarState();

    try {
      sessionStorage.setItem(SESSION_KEY_CODE_VERIFIER, codeVerifier);
      sessionStorage.setItem(SESSION_KEY_STATE, state);
    } catch (err) {
      console.error('[HU-010] Error al escribir en sessionStorage. Flujo OIDC abortado.', err);
      return;
    }

    const authUrl = new URL(this.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', this.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
  }

  /** Convierte un buffer a Base64 URL-safe sin padding (RFC 7636). */
  private toBase64UrlSafe(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /** Genera code_verifier: 32 bytes aleatorios codificados en Base64 URL-safe (RN-001). */
  private generarCodeVerifier(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return this.toBase64UrlSafe(bytes);
  }

  /** Deriva code_challenge via SHA-256 del code_verifier (RN-002). */
  private async derivarCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.toBase64UrlSafe(digest);
  }

  /** Genera state CSRF: 16 bytes aleatorios codificados en Base64 URL-safe (RN-003). */
  private generarState(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return this.toBase64UrlSafe(bytes);
  }
}
