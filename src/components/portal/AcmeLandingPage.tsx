import { useSearchParams, Navigate } from 'react-router-dom';
import type { LandingPageProps } from './LandingPage';
import { AcmeHeader } from './AcmeHeader';
import { AcmeFooter } from './AcmeFooter';

// --- Constantes OIDC (HU-010) ---
// Endpoint de autorización del Identity Provider CGCOM
const OIDC_AUTHORIZATION_ENDPOINT = 'https://verifier.cgcom.demo.fikua.com/oidc/authorize';

// client_id registrado en el IdP (PA-001 — pendiente de confirmar con el equipo)
// Añadir VITE_OIDC_CLIENT_ID al fichero .env cuando se disponga del valor real.
const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'PENDIENTE_CLIENT_ID';

// redirect_uri configurable por entorno (RNF-004, RN-005)
// Valor por defecto: producción. Sobreescribir con VITE_OIDC_REDIRECT_URI en .env.development
const OIDC_REDIRECT_URI =
  import.meta.env.VITE_OIDC_REDIRECT_URI ?? 'https://issuer.cgcom.demo.fikua.com';

// Scopes solicitados al IdP (RN-006 — no configurable en HU-010)
const OIDC_SCOPE = 'openid profile email offline_access doctorid role';

// Claves de sessionStorage para persistir los valores PKCE entre la solicitud y la callback
const SESSION_KEY_CODE_VERIFIER = 'oidc_code_verifier';
const SESSION_KEY_STATE = 'oidc_state';
// --- Fin constantes OIDC ---

/**
 * Convierte un ArrayBuffer o Uint8Array a una cadena Base64 URL-safe sin padding.
 * Sustituye '+' por '-', '/' por '_' y elimina el padding '='.
 * Necesario para code_verifier, code_challenge y state (RFC 7636, RN-001, RN-002).
 */
function toBase64UrlSafe(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // Convertir a string binaria y luego a base64 mediante btoa
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Genera el code_verifier PKCE: 32 bytes aleatorios criptográficos codificados en
 * Base64 URL-safe sin padding. Resultado ≈ 43 caracteres. (RF-001, RNF-001, RN-001)
 */
function generarCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64UrlSafe(bytes);
}

/**
 * Deriva el code_challenge a partir del code_verifier mediante SHA-256.
 * El resultado se codifica en Base64 URL-safe sin padding (método S256).
 * (RF-001, RNF-001, RN-002)
 */
async function derivarCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toBase64UrlSafe(digest);
}

/**
 * Genera el parámetro state para protección CSRF: 16 bytes aleatorios criptográficos
 * codificados en Base64 URL-safe sin padding. Resultado ≈ 22 caracteres.
 * Siempre se genera un valor nuevo al pulsar el botón; nunca se reutiliza. (RF-002, RNF-002, RN-003)
 */
function generarState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64UrlSafe(bytes);
}

/**
 * Inicia el flujo OIDC Authorization Code con PKCE (HU-010).
 *
 * Secuencia de operaciones (RN-004, RN-007):
 * 1. Genera code_verifier (síncrono)
 * 2. Deriva code_challenge via SHA-256 (asíncrono)
 * 3. Genera state (síncrono)
 * 4. Escribe code_verifier y state en sessionStorage (try/catch — FA-001)
 * 5. Construye la URL de autorización con URLSearchParams
 * 6. Redirige el navegador en la misma pestaña (window.location.href)
 */
async function iniciarFlujoOIDC(): Promise<void> {
  // Paso 1: generar code_verifier
  const codeVerifier = generarCodeVerifier();

  // Paso 2: derivar code_challenge (await — operación asíncrona)
  const codeChallenge = await derivarCodeChallenge(codeVerifier);

  // Paso 3: generar state
  const state = generarState();

  // Paso 4: persistir en sessionStorage antes de redirigir (RF-003, FA-001)
  try {
    sessionStorage.setItem(SESSION_KEY_CODE_VERIFIER, codeVerifier);
    sessionStorage.setItem(SESSION_KEY_STATE, state);
  } catch (err) {
    console.error('[HU-010] Error al escribir en sessionStorage. Flujo OIDC abortado.', err);
    return; // La redirección no se ejecuta si sessionStorage falla (RN-004)
  }

  // Paso 5: construir URL de autorización con URLSearchParams (RF-004, RN-005, RN-006)
  const authUrl = new URL(OIDC_AUTHORIZATION_ENDPOINT);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', OIDC_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', OIDC_REDIRECT_URI);
  authUrl.searchParams.set('scope', OIDC_SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Paso 6: redirigir en la misma pestaña (RF-005, RN-007)
  window.location.href = authUrl.toString();
}

// Maqueta visual de marca ACME — todos los elementos interactivos son no-op intencionadamente,
// excepto el botón "Acceso con DoctorID" que inicia el flujo OIDC (HU-010).
export function AcmeLandingPage(_props: LandingPageProps) {
  // RF-001 — Detección de callback OIDC (HU-011, Fase 2)
  // Si el IdP devuelve ?code=<valor>, redirigir inmediatamente a /cliente/home sin
  // añadir la URL de callback al historial (replace: true).
  // FA-001: code === null cuando el parámetro está ausente → falsy, no redirige.
  // FA-002: code === '' cuando el parámetro está presente pero vacío → falsy, no redirige.
  // Nota: useSearchParams requiere que el componente esté dentro de <BrowserRouter>.
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  if (code) return <Navigate to="/cliente/home" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <AcmeHeader />

      {/* Área principal: imagen de fondo a pantalla completa con card centrado */}
      <main
        className="flex-1 relative flex items-center justify-center py-12 px-4"
        style={{
          backgroundImage: 'url(/acme-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay azulado semitransparente para legibilidad */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: 'rgba(26, 82, 118, 0.55)' }}
          aria-hidden="true"
        />

        {/* Card de login */}
        <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
          {/* Titulo */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Acceso
          </h1>

          {/* Subtitulo */}
          <p className="text-sm text-gray-500 text-center mb-3">
            Para acceder introduce tu usuario y tu contraseña.
          </p>

          {/* Enlace de ayuda — no-op */}
          <div className="text-center mb-6">
            <a
              href="#"
              onClick={(e) => e.preventDefault()} // no-op (maqueta visual)
              className="text-sm text-[#2874A6] hover:underline"
            >
              Necesito ayuda para acceder
            </a>
          </div>

          <div className="space-y-5">
            {/* Campo Usuario */}
            <div>
              <label
                htmlFor="acme-usuario"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Usuario
              </label>
              <input
                id="acme-usuario"
                type="text"
                autoComplete="username"
                readOnly
                placeholder="Introduce tu usuario"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#2874A6] focus:border-[#2874A6]"
              />
            </div>

            {/* Campo Contraseña */}
            <div>
              <label
                htmlFor="acme-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Contraseña
              </label>
              <input
                id="acme-password"
                type="password"
                autoComplete="current-password"
                readOnly
                placeholder="Introduce tu contraseña"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#2874A6] focus:border-[#2874A6]"
              />
            </div>

            {/* Boton Entrar — no-op */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {}} // no-op (maqueta visual)
                className="px-10 py-2 border-2 border-[#1A5276] text-[#1A5276] font-semibold rounded-md text-sm hover:bg-[#1A5276] hover:text-white transition-colors"
              >
                Entrar
              </button>
            </div>

            {/* Checkbox Recuérdame — no-op (maqueta visual) */}
            <div className="flex justify-center">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-[#2874A6] focus:ring-[#2874A6]"
                  onChange={() => {}} // no-op (maqueta visual)
                />
                Recuérdame
              </label>
            </div>
          </div>

          {/* Divisor "o" — separa formulario usuario/contraseña del acceso con DoctorID */}
          <div className="flex items-center gap-3 my-5">
            <hr className="flex-1 border-gray-300" />
            <span className="text-xs text-gray-400">o</span>
            <hr className="flex-1 border-gray-300" />
          </div>

          {/* Botón "Acceso con DoctorID" — inicia flujo OIDC Authorization Code con PKCE (HU-010) */}
          <button
            type="button"
            onClick={() => { iniciarFlujoOIDC(); }}
            className="w-full flex items-center justify-center gap-3 px-4 py-10 rounded-md bg-[#E67E22] text-white text-sm font-semibold hover:bg-[#D35400] transition-colors"
          >
            Acceso con DoctorID
          </button>
        </div>
      </main>

      <AcmeFooter />
    </div>
  );
}
