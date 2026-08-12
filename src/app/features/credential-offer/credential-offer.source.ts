import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, TimeoutError, catchError, map, of, timeout } from 'rxjs';
import { CredentialOfferConfig } from './credential-offer-config.model';
import { CredentialOfferResult } from './credential-offer.model';
import { validateCredentialOfferReference } from './validate-credential-offer-reference';

/** Plazo máximo de espera de la oferta (AD-3, NFR-P-163-01) — sin reintentos automáticos. */
export const CREDENTIAL_OFFER_REQUEST_TIMEOUT_MS = 15_000;

/** Cuerpo de la solicitud al proceso de emisión — mismo contrato heredado del material demo (R-4). */
export interface CredentialOfferRequestContext {
  name: string;
  email: string;
  collegiateNumber: string;
  dni: string;
}

/**
 * Adapter de obtención de la oferta de credencial (EUD-3/EUD-4).
 *
 * Nunca lanza: siempre resuelve a un `CredentialOfferResult` tipado. Nunca
 * registra `status`, `error` ni `url` (NFR-S-163-03) — ni en consola ni en
 * el resultado devuelto al llamante.
 *
 * Cancelación al timeout: `HttpClient` cancela la petición subyacente al
 * `unsubscribe()`, que es justo lo que dispara el operador `timeout()` de
 * RxJS al expirar el plazo — no se necesita un `AbortController` explícito
 * (ese mecanismo es para `fetch` crudo, no para `HttpClient`).
 */
@Injectable({ providedIn: 'root' })
export class CredentialOfferSource {
  private readonly http = inject(HttpClient);

  fetch(
    config: CredentialOfferConfig,
    context: CredentialOfferRequestContext,
  ): Observable<CredentialOfferResult> {
    return this.http.post<{ credentialOfferUrl?: unknown }>(config.endpoint, context).pipe(
      timeout(CREDENTIAL_OFFER_REQUEST_TIMEOUT_MS),
      map((data): CredentialOfferResult => {
        const reference = data?.credentialOfferUrl;
        if (!validateCredentialOfferReference(reference)) {
          return { ok: false, reason: 'malformed' };
        }
        return { ok: true, offer: { reference, obtainedAt: Date.now() } };
      }),
      catchError((err: unknown): Observable<CredentialOfferResult> => {
        if (err instanceof TimeoutError) {
          return of({ ok: false, reason: 'timeout' });
        }
        return of({ ok: false, reason: 'issuance_error' });
      }),
    );
  }
}
