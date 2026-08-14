/**
 * Estado del ciclo de vida de la sesión de arranque (SRS §7). `iniciada`:
 * creada al pulsar el CTA, antes de elegir método. `redirigida`: se eligió
 * "Certificado Digital" y la salida externa quedó sellada (EUD-164, AD-1/
 * AD-2). `retomada`: el retorno se correlacionó y la referencia quedó
 * consumida (uso único, AC-05).
 */
export type IssuanceStartSessionState = 'iniciada' | 'redirigida' | 'retomada';

/**
 * Sesión de arranque del titular (SRS §7). Los campos desde `createdAt` en
 * adelante son opcionales y aditivos (EUD-164): EUD-163/EUD-165 solo leen
 * `id`/`tenant` → cero impacto en su comportamiento.
 */
export interface IssuanceStartSession {
  id: string;
  tenant: string;
  state: IssuanceStartSessionState;
  /** Instante de creación (`iniciada`). */
  createdAt?: number;
  /** Instante en el que se selló `redirigida` — base de la ventana de validez (NFR-S-164-01). */
  redirectedAt?: number;
  /** Instante absoluto de expiración (`redirectedAt + ISSUANCE_START_SESSION_TTL_MS`). */
  expiresAt?: number;
  /** Referencia de correlación de un solo uso (128 bits, NFR-S-164-02). */
  correlationToken?: string;
  /** Instante en el que la referencia se consumió al retomar el flujo (AC-05, uso único). */
  consumedAt?: number;
  /** Método que produjo la salida externa. Solo `'certificate'` está en alcance de EUD-164. */
  redirectedMethod?: 'certificate';
}
