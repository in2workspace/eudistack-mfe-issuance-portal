import { InjectionToken, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Lo que la pantalla de error necesita de la sesión del titular con el
 * Verifier. Lo provee el cliente OIDC (EUD-314); hasta entonces no hay
 * tokens que descartar y volver a identificarse empieza en Inicio.
 */
export interface SessionActions {
  /** Vuelve a llevar al titular al inicio de sesión del Verifier. */
  restartLogin(): Promise<void>;
  /** Descarta los tokens del titular. */
  discardTokens(): void;
}

export const SESSION_ACTIONS = new InjectionToken<SessionActions>('SESSION_ACTIONS', {
  providedIn: 'root',
  factory: () => {
    const router = inject(Router);
    return {
      restartLogin: async () => {
        await router.navigate(['/']);
      },
      discardTokens: () => undefined,
    };
  },
});
