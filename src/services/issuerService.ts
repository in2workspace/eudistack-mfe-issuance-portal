/**
 * issuerService.ts
 *
 * Cliente del endpoint /api/bootstrap del backend (cert-server.mjs).
 * Envía los datos del médico al backend, que a su vez construye el payload
 * completo y llama al issuer CGCOM con el token. Así se evita CORS y no
 * se expone el token en el cliente.
 */

import type { AuthenticatedUser } from '../types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** URL del endpoint bootstrap. En producción: ruta relativa (serverless function). En dev: cert-server local. */
const BACKEND_URL = import.meta.env.VITE_BOOTSTRAP_API_URL ?? 'https://localhost:3443/api/bootstrap';

/** Timeout en milisegundos para la petición al backend (RNF-001). */
const REQUEST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/**
 * Resultado discriminado de la llamada al endpoint de bootstrap.
 * Siempre gestionar ambos casos explícitamente en el código llamante.
 */
export type BootstrapResult =
  | { success: true; credentialOfferUrl: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Función pública
// ---------------------------------------------------------------------------

/**
 * Envía los datos del médico al backend para obtener una Credential Offer URL.
 *
 * El backend (cert-server.mjs) se encarga de:
 * - Construir el payload completo (mandator fijo + mandatee del usuario)
 * - Añadir el X-Bootstrap-Token
 * - Llamar al issuer CGCOM
 * - Extraer el header Location de la respuesta
 *
 * @param user - Médico autenticado cuyos datos se envían al backend.
 * @returns BootstrapResult — discriminated union con éxito o error descriptivo.
 */
export async function bootstrap(user: AuthenticatedUser): Promise<BootstrapResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        collegiateNumber: user.collegiateNumber,
        dni: user.dni,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const detail = data?.error || `Error ${response.status}`;
      return {
        success: false,
        error: `Error del emisor: ${detail}`,
      };
    }

    const data = await response.json();

    if (!data.credentialOfferUrl) {
      return {
        success: false,
        error: 'El emisor no devolvió una oferta de credencial válida. Inténtalo de nuevo.',
      };
    }

    return { success: true, credentialOfferUrl: data.credentialOfferUrl };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: 'La petición ha tardado demasiado. Inténtalo de nuevo.',
      };
    }

    return {
      success: false,
      error: 'Error de red. Comprueba tu conexión e inténtalo de nuevo.',
    };
  }
}
