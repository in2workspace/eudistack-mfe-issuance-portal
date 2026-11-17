import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { AbstractSecurityStorage, StsConfigLoader, StsConfigStaticLoader, provideAuth } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { resolveTenantIdentity } from '../branding/resolve-tenant-identity';
import { SESSION_ACTIONS } from '../session/session-actions';
import { HolderAuthService } from './holder-auth.service';
import { buildOidcConfig } from './oidc-config';
import { OidcFlowStorage } from './oidc-flow-storage';

/**
 * Inicio de sesión del titular con el Verifier: el cliente OIDC del tenant,
 * su almacenamiento en memoria y lo que el resto de la interfaz usa de él, el
 * Access Token para el interceptor de la API y las acciones de sesión.
 * La configuración se construye al primer uso, cuando ya se conoce el tenant.
 */
export function provideHolderAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAuth({
      loader: {
        provide: StsConfigLoader,
        useFactory: () =>
          new StsConfigStaticLoader(
            buildOidcConfig(resolveTenantIdentity(window.location, environment) ?? '', window.location.origin),
          ),
      },
    }),
    { provide: AbstractSecurityStorage, useExisting: OidcFlowStorage },
    {
      provide: ISSUANCE_PORTAL_ACCESS_TOKEN,
      useFactory: () => {
        const auth = inject(HolderAuthService);
        return () => auth.accessToken();
      },
    },
    {
      provide: SESSION_ACTIONS,
      useFactory: () => {
        const auth = inject(HolderAuthService);
        return {
          restartLogin: async () => auth.loginAgain(),
          resumeLogin: async (returnTo?: string) => auth.loginSilently(returnTo),
          discardTokens: () => auth.discard(),
        };
      },
    },
  ]);
}
