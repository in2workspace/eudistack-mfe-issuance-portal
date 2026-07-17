import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError, map, TimeoutError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantBrandingDescriptor, TenantBrandingResult } from './tenant-branding.model';

/**
 * Carga en runtime el descriptor de branding/idioma de un tenant desde el
 * repositorio de assets compartido (`{assetsBaseUrl}/{tenant}/theme.json`,
 * SAD §8.8). Nunca lanza ni propaga el error al llamante (ES-01/ES-02/ES-04/
 * ES-05): siempre emite un `TenantBrandingResult` fail-safe. La política de
 * fallback (a qué default caer) vive en `resolveTenantBranding()`, no aquí.
 */
@Injectable({ providedIn: 'root' })
export class TenantBrandingSource {
  private readonly http = inject(HttpClient);

  /** Presupuesto de tiempo para no bloquear el primer render (AC-06/ES-05), mismo patrón que `IssuerService`. */
  private static readonly REQUEST_TIMEOUT_MS = 3_000;

  load(tenant: string): Observable<TenantBrandingResult> {
    const url = `${environment.assetsBaseUrl}/${tenant}/theme.json`;

    return this.http.get<unknown>(url).pipe(
      timeout(TenantBrandingSource.REQUEST_TIMEOUT_MS),
      map((descriptor) => this.toResult(descriptor)),
      catchError((err: unknown) => of(this.toErrorResult(err))),
    );
  }

  private toResult(descriptor: unknown): TenantBrandingResult {
    if (typeof descriptor !== 'object' || descriptor === null || Array.isArray(descriptor)) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, descriptor: descriptor as TenantBrandingDescriptor };
  }

  private toErrorResult(err: unknown): TenantBrandingResult {
    if (err instanceof TimeoutError) {
      return { ok: false, reason: 'timeout' };
    }

    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) {
        console.warn('[TenantBrandingSource] tenant branding descriptor not found (absent)');
        return { ok: false, reason: 'absent' };
      }
      if (err.status === 0 || err.status >= 500) {
        console.warn('[TenantBrandingSource] network/server failure loading tenant branding', err.status);
        return { ok: false, reason: 'error' };
      }
      // Fallos de parseo del body (JSON inválido) llegan como HttpErrorResponse con status 200.
      console.warn('[TenantBrandingSource] malformed tenant branding descriptor');
      return { ok: false, reason: 'invalid' };
    }

    console.warn('[TenantBrandingSource] unexpected failure loading tenant branding', err);
    return { ok: false, reason: 'error' };
  }
}
