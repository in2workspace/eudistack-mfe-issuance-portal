import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'portal', pathMatch: 'full' },
  {
    path: 'portal',
    loadComponent: () =>
      import('./features/issuance-start/issuance-info/issuance-info.component').then(
        (m) => m.IssuanceInfoComponent,
      ),
  },
  {
    // Selección de método de identificación — extraída del paso 'select' de
    // ClaveAuthComponent (eudistack-cgcom-mfe-cert-identifier). Al elegir un
    // método redirige a /cert/?method=<id>, que entra directo en 'authenticate'.
    path: 'portal/identify',
    loadComponent: () =>
      import('./features/portal/identify-methods/identify-methods.component').then(
        (m) => m.IdentifyMethodsComponent,
      ),
  },
  {
    path: 'portal/user-data',
    loadComponent: () =>
      import('./features/portal/user-data/user-data.component').then(
        (m) => m.UserDataComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'portal/qr',
    loadComponent: () =>
      import('./features/portal/credential-qr/credential-qr.component').then(
        (m) => m.CredentialQrComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'portal/incidents',
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
  { path: '**', redirectTo: 'portal' },
];
