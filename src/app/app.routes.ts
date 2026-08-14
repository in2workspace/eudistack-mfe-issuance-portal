import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { identificationReturnGuard } from './core/guards/identification-return.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/issuance-start/issuance-info/issuance-info.component').then(
        (m) => m.IssuanceInfoComponent,
      ),
  },
  {
    // Selección de método de identificación — extraída del paso 'select' de
    // ClaveAuthComponent (eudistack-cgcom-mfe-cert-identifier). Al elegir un
    // método redirige a /cert/?method=<id>, que entra directo en 'authenticate'.
    path: 'identify',
    loadComponent: () =>
      import('./features/portal/identify-methods/identify-methods.component').then(
        (m) => m.IdentifyMethodsComponent,
      ),
  },
  {
    path: 'user-data',
    loadComponent: () =>
      import('./features/portal/user-data/user-data.component').then(
        (m) => m.UserDataComponent,
      ),
    // EUD-164 (AD-6): identificationReturnGuard es la segunda capa —
    // deniega solo si el retorno del carril "certificate" fue rechazado.
    canActivate: [authGuard, identificationReturnGuard],
  },
  {
    // EUD-163: sustituye la ruta demo 'qr' (AD-5) — presenta la oferta real
    // como QR + deeplink, con caducidad y timeout reales.
    path: 'offer',
    loadComponent: () =>
      import('./features/credential-offer/credential-offer.component').then(
        (m) => m.CredentialOfferComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'incidents',
    loadComponent: () =>
      import('./features/portal/incidents/incidents.component').then((m) => m.IncidentsComponent),
  },
  {
    path: 'cliente',
    loadComponent: () =>
      import('./features/acme/acme-landing/acme-landing.component').then(
        (m) => m.AcmeLandingComponent,
      ),
  },
  {
    path: 'cliente/home',
    loadComponent: () =>
      import('./features/acme/acme-home/acme-home.component').then((m) => m.AcmeHomeComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
