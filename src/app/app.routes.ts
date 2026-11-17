import { Routes } from '@angular/router';
import { journeyStepGuard } from './core/journey/journey-step.guard';
import { heldOutcomeGuard } from './core/journey/entitlement-outcome.store';
import {
  DATA_ROUTE,
  EMAIL_PATH,
  ENTITLEMENT_PATH,
  NO_REQUESTS_PATH,
  QR_ROUTE,
  REQUESTS_PATH,
  REQUEST_UNAVAILABLE_PATH,
} from './core/journey/journey-paths';
import { CONFIG_UNAVAILABLE_PATH, configAvailableGuard, configUnavailableGuard } from './core/guards/config-available.guard';
import { LOGIN_CALLBACK_PATH } from './core/auth/oidc-config';
import { legacyQueryParamsGuard } from './core/guards/legacy-query-params.guard';
import { ERROR_PATH, errorReasonGuard } from './features/error/error-reason';
import {
  INCIDENT_SENT_PATH,
  INCIDENTS_PATH,
  incidentResponseTimeResolver,
  incidentSentGuard,
} from './features/portal/incidents/incident-sent.route';

export const routes: Routes = [
  {
    // Configuración del portal no disponible (prd.md §3.4): el único caso de
    // la pantalla de error que no necesita la configuración del tenant.
    path: CONFIG_UNAVAILABLE_PATH,
    loadComponent: () => import('./features/error/error.component').then((m) => m.ErrorComponent),
    data: { reason: 'config-unavailable' },
    canActivate: [legacyQueryParamsGuard, configUnavailableGuard],
  },
  {
    // Todas las pantallas necesitan la configuración del tenant.
    path: '',
    canActivateChild: [legacyQueryParamsGuard, configAvailableGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/issuance-start/issuance-info/issuance-info.component').then(
            (m) => m.IssuanceInfoComponent,
          ),
      },
      {
        // Vuelta del inicio de sesión del Verifier (EUD-314): abre el recorrido y sigue a su paso.
        path: LOGIN_CALLBACK_PATH,
        loadComponent: () =>
          import('./features/login-callback/login-callback.component').then((m) => m.LoginCallbackComponent),
      },
      {
        // Paso Comprobación (EUD-286): comprueba el derecho y pasa solo a Correo o a la pantalla que toque.
        path: ENTITLEMENT_PATH,
        data: { back: '' },
        loadComponent: () =>
          import('./features/entitlement/entitlement.component').then((m) => m.EntitlementComponent),
        canActivate: [journeyStepGuard],
      },
      {
        // Paso Correo (EUD-358, EUD-359): el correo y el código que el servicio envía a él, una vez por sesión.
        path: EMAIL_PATH,
        loadComponent: () =>
          import('./features/portal/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
        canActivate: [journeyStepGuard],
      },
      {
        // Solicitudes (design.md §3.5): el estado de cada una, que se vuelve a pedir al entrar.
        path: REQUESTS_PATH,
        loadComponent: () => import('./features/requests/requests.component').then((m) => m.RequestsComponent),
        canActivate: [journeyStepGuard],
      },
      {
        // Sin solicitudes y Tus datos no coinciden (AD-8): sin guarda de paso, muestran lo que hay en memoria.
        path: NO_REQUESTS_PATH,
        loadComponent: () =>
          import('./features/no-requests/no-requests.component').then((m) => m.NoRequestsComponent),
        canActivate: [heldOutcomeGuard('no-requests')],
      },
      {
        path: REQUEST_UNAVAILABLE_PATH,
        loadComponent: () =>
          import('./features/request-unavailable/request-unavailable.component').then(
            (m) => m.RequestUnavailableComponent,
          ),
        canActivate: [heldOutcomeGuard('request-unavailable')],
      },
      {
        // Datos de una solicitud (design.md AD-9): su identificador va en la ruta.
        path: DATA_ROUTE,
        loadComponent: () =>
          import('./features/portal/user-data/user-data.component').then(
            (m) => m.UserDataComponent,
          ),
        canActivate: [journeyStepGuard],
      },
      {
        // EUD-163: sustituye la ruta demo 'qr' (AD-5) — presenta la oferta real de una
        // solicitud como QR + deeplink, con caducidad y timeout reales.
        path: QR_ROUTE,
        loadComponent: () =>
          import('./features/credential-offer/credential-offer.component').then(
            (m) => m.CredentialOfferComponent,
          ),
        canActivate: [journeyStepGuard],
      },
      {
        // Pantalla de error única (prd.md §3.4), sin botón de volver.
        path: `${ERROR_PATH}/:reason`,
        loadComponent: () => import('./features/error/error.component').then((m) => m.ErrorComponent),
        canActivate: [errorReasonGuard],
      },
      {
        path: INCIDENTS_PATH,
        data: { back: '' },
        loadComponent: () =>
          import('./features/portal/incidents/incidents.component').then((m) => m.IncidentsComponent),
      },
      {
        // Ayuda enviada, sin botón de volver; solo se llega al enviar una incidencia.
        path: INCIDENT_SENT_PATH,
        loadComponent: () =>
          import('./features/portal/incidents/incident-sent.component').then((m) => m.IncidentSentComponent),
        canActivate: [incidentSentGuard],
        resolve: { responseTime: incidentResponseTimeResolver },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
