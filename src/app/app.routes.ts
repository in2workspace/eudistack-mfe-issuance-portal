import { Routes } from '@angular/router';
import { journeyStepGuard } from './core/journey/journey-step.guard';
import { DATA_PATH, ENTITLEMENT_PATH, QR_PATH } from './core/journey/journey-paths';
import { CONFIG_UNAVAILABLE_PATH, configAvailableGuard, configUnavailableGuard } from './core/guards/config-available.guard';
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
        // Paso Comprobación (EUD-286): comprueba el derecho y pasa solo a Datos o a Error.
        path: ENTITLEMENT_PATH,
        data: { back: '' },
        loadComponent: () =>
          import('./features/entitlement/entitlement.component').then((m) => m.EntitlementComponent),
        canActivate: [journeyStepGuard],
      },
      {
        path: DATA_PATH,
        data: { back: '' },
        loadComponent: () =>
          import('./features/portal/user-data/user-data.component').then(
            (m) => m.UserDataComponent,
          ),
        canActivate: [journeyStepGuard],
      },
      {
        // EUD-163: sustituye la ruta demo 'qr' (AD-5) — presenta la oferta real
        // como QR + deeplink, con caducidad y timeout reales.
        path: QR_PATH,
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
