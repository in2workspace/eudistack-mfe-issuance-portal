import { Injectable } from '@angular/core';
import { AbstractSecurityStorage } from 'angular-auth-oidc-client';

/** Clave de `sessionStorage` con lo que el login necesita para sobrevivir a la ida al Verifier. */
export const FLOW_STORAGE_KEY = 'portal-login-flow';

/** Clave de `sessionStorage` con la hora de la última ida al Verifier por una renovación fallida (W4). */
export const REDIRECT_MARK_KEY = 'portal-verifier-redirect';

/** Clave de `sessionStorage` con la ruta a la que volver tras recuperar los tokens (EUD-359, EC-06). */
export const RETURN_PATH_KEY = 'portal-login-return';

/**
 * Campos que la librería escribe antes de salir hacia el Verifier y lee en la
 * vuelta: el `code_verifier` de PKCE, el `state` y el `nonce`. Son aleatorios,
 * de un solo uso y no identifican al titular.
 */
export const FLOW_FIELDS = ['codeVerifier', 'authStateControl', 'authNonce'] as const;

/**
 * Almacenamiento de la librería OIDC (design.md AD-6): todo en memoria
 * (tokens, ID Token, datos del usuario), salvo los tres campos de
 * `FLOW_FIELDS`. El `authorize` es una redirección de página completa y la
 * memoria no la sobrevive: sin el `code_verifier`, el `state` y el `nonce` la
 * vuelta no se puede validar (ES-04). Esos tres van a `sessionStorage` solo
 * mientras el titular está en el Verifier y `clearFlow()` los borra en cuanto
 * se procesa la vuelta, con éxito o sin él.
 *
 * La librería guarda un único valor JSON por configuración: se parte en
 * memoria y flujo al escribir y se une al leer.
 */
@Injectable({ providedIn: 'root' })
export class OidcFlowStorage extends AbstractSecurityStorage {
  private readonly memory = new Map<string, string>();

  read(key: string): string | null {
    const own = this.memory.get(key);
    const flow = this.readFlow();
    if (own === undefined && flow === null) {
      return null;
    }
    return JSON.stringify({ ...(flow ?? {}), ...(own === undefined ? {} : (JSON.parse(own) as object)) });
  }

  write(key: string, value: string): void {
    const all = (JSON.parse(value) ?? {}) as Record<string, unknown>;
    const flow: Record<string, unknown> = {};
    for (const field of FLOW_FIELDS) {
      if (all[field]) {
        flow[field] = all[field];
      }
      delete all[field];
    }
    this.memory.set(key, JSON.stringify(all));
    this.writeFlow(flow);
  }

  remove(key: string): void {
    this.memory.delete(key);
  }

  clear(): void {
    this.memory.clear();
    this.clearFlow();
    this.takeReturnPath();
  }

  /** Hora (ms) de la última ida al Verifier por una renovación fallida, o `null`. Sin datos del titular. */
  readRedirectMark(): number | null {
    try {
      const value = Number(sessionStorage.getItem(REDIRECT_MARK_KEY));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  writeRedirectMark(at: number): void {
    try {
      sessionStorage.setItem(REDIRECT_MARK_KEY, String(at));
    } catch {
      // Sin sessionStorage no se puede limitar las idas: la ventana no se aplica.
    }
  }

  clearRedirectMark(): void {
    try {
      sessionStorage.removeItem(REDIRECT_MARK_KEY);
    } catch {
      // Sin sessionStorage tampoco hay marca que borrar.
    }
  }

  /**
   * Ruta de la interfaz a la que volver tras recuperar los tokens, para que
   * recargar la página en los Datos o el QR de una solicitud la retome (EC-06).
   * Solo la ruta, con el identificador opaco de la solicitud: ningún dato del
   * titular. Se lee una sola vez.
   */
  writeReturnPath(path: string): void {
    try {
      sessionStorage.setItem(RETURN_PATH_KEY, path);
    } catch {
      // Sin sessionStorage el titular vuelve al paso que dice el recorrido.
    }
  }

  /** Lee y borra la ruta de `writeReturnPath`, o `null` si no hay. */
  takeReturnPath(): string | null {
    try {
      const path = sessionStorage.getItem(RETURN_PATH_KEY);
      sessionStorage.removeItem(RETURN_PATH_KEY);
      return path;
    } catch {
      return null;
    }
  }

  /** Borra de `sessionStorage` lo que dejó la ida al Verifier. */
  clearFlow(): void {
    try {
      sessionStorage.removeItem(FLOW_STORAGE_KEY);
    } catch {
      // Sin sessionStorage tampoco hay nada que borrar.
    }
  }

  private readFlow(): Record<string, unknown> | null {
    try {
      const raw = sessionStorage.getItem(FLOW_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private writeFlow(flow: Record<string, unknown>): void {
    if (Object.keys(flow).length === 0) {
      this.clearFlow();
      return;
    }
    try {
      sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flow));
    } catch {
      // Sin sessionStorage el login no puede validar la vuelta y falla en ella (ES-04).
    }
  }
}
