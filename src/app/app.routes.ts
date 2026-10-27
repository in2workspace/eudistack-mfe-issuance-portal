import { Routes } from '@angular/router';
import { pendingJourneyGuard } from './core/guards/pending-journey.guard';
import { CONFIG_UNAVAILABLE_PATH, configAvailableGuard, configUnavailableGuard } from './core/guards/config-available.guard';

export const routes: Routes = [
  {
    // Configuración del portal no disponible (prd.md §3.4).
    path: CONFIG_UNAVAILABLE_PATH,
    loadComponent: () =>
      import('./features/config-unavailable/config-unavailable.component').then((m) => m.ConfigUnavailableComponent),
    canActivate: [configUnavailableGuard],
  },
  {
    // Todas las pantallas necesitan la configuración del tenant.
    path: '',
    canActivateChild: [configAvailableGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/issuance-start/issuance-info/issuance-info.component').then(
            (m) => m.IssuanceInfoComponent,
          ),
      },
      {
        path: 'user-data',
        data: { back: '' },
        loadComponent: () =>
          import('./features/portal/user-data/user-data.component').then(
            (m) => m.UserDataComponent,
          ),
        canActivate: [pendingJourneyGuard],
      },
      {
        // EUD-163: sustituye la ruta demo 'qr' (AD-5) — presenta la oferta real
        // como QR + deeplink, con caducidad y timeout reales.
        path: 'offer',
        loadComponent: () =>
          import('./features/credential-offer/credential-offer.component').then(
            (m) => m.CredentialOfferComponent,
          ),
        canActivate: [pendingJourneyGuard],
      },
      {
        path: 'incidents',
        data: { back: '' },
        loadComponent: () =>
          import('./features/portal/incidents/incidents.component').then((m) => m.IncidentsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
