/** Estado de la sesión de arranque del titular (SRS §7). */
export type IssuanceStartSessionState = 'iniciada';

/**
 * Sesión de arranque del titular. Creada al activar el CTA de la pantalla
 * informativa; persistida en `sessionStorage` para correlación con EUD-164
 * al retorno del flujo de identificación.
 */
export interface IssuanceStartSession {
  id: string;
  tenant: string;
  state: IssuanceStartSessionState;
}
