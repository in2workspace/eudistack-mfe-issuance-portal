import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError, map } from 'rxjs';
import { AuthenticatedUser, BootstrapResult } from '../models/issuance.model';

/**
 * Cliente del endpoint /api/bootstrap del backend (cert-server.mjs).
 *
 * Porta issuerService.ts (React/fetch) a HttpClient de Angular.
 * Timeout de 10 s (RNF-001). Devuelve un discriminated union BootstrapResult
 * para que el componente llamante gestione siempre ambos casos.
 *
 * Ruta same-origin (AD-2): nginx enruta `/identify/api/bootstrap` al mismo
 * `cert-server` bajo cualquier subdominio de tenant — sin host hardcodeado.
 */
@Injectable({ providedIn: 'root' })
export class IssuerService {
  private http = inject(HttpClient);
  private backendUrl = '/identify/api/bootstrap';

  /** Timeout en milisegundos para la petición al backend (RNF-001). */
  private static readonly REQUEST_TIMEOUT_MS = 10_000;

  /**
   * Envía los datos del médico al backend para obtener una Credential Offer URL.
   *
   * @param user Médico autenticado cuyos datos se envían al backend.
   * @returns Observable<BootstrapResult> — siempre emite un valor (éxito o error descriptivo).
   */
  bootstrap(user: AuthenticatedUser): Observable<BootstrapResult> {
    return this.http
      .post<{ credentialOfferUrl: string }>(this.backendUrl, {
        name: user.name,
        email: user.email,
        collegiateNumber: user.collegiateNumber,
        dni: user.dni,
      })
      .pipe(
        timeout(IssuerService.REQUEST_TIMEOUT_MS),
        map((data) => {
          if (!data.credentialOfferUrl) {
            return {
              success: false as const,
              error: 'El emisor no devolvió una oferta de credencial válida. Inténtalo de nuevo.',
            };
          }
          return { success: true as const, credentialOfferUrl: data.credentialOfferUrl };
        }),
        catchError((err: HttpErrorResponse | Error) => {
          const message =
            err.message?.includes('timeout') || err.message?.includes('TimeoutError')
              ? 'La petición ha tardado demasiado. Inténtalo de nuevo.'
              : 'Error de red. Comprueba tu conexión e inténtalo de nuevo.';
          return of({ success: false as const, error: message });
        }),
      );
  }
}
