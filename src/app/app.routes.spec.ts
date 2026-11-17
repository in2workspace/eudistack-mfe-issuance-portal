import { Route } from '@angular/router';
import { routes } from './app.routes';
import { configAvailableGuard, configUnavailableGuard } from './core/guards/config-available.guard';
import { journeyStepGuard } from './core/journey/journey-step.guard';
import { incidentResponseTimeResolver, incidentSentGuard } from './features/portal/incidents/incident-sent.route';

describe('routes', () => {
  /** Rutas de las pantallas: las hijas de la ruta que exige la configuración. */
  const screens: Route[] = routes.find((r) => r.path === '' && r.children)?.children ?? [];

  function findRoute(path: string): Route {
    const route = screens.find((r) => r.path === path);
    if (!route) {
      throw new Error(`Route "${path}" not found`);
    }
    return route;
  }

  it('"" lazy-loads IssuanceInfoComponent (EUD-162 entry point)', async () => {
    const root = findRoute('');

    const loaded = await (root.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('IssuanceInfoComponent');
  });

  it('AD-8: "requests/:requestId/offer" lazy-loads CredentialOfferComponent and is protected by journeyStepGuard', async () => {
    const offer = findRoute('requests/:requestId/offer');

    const loaded = await (offer.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('CredentialOfferComponent');
    expect(offer.canActivate).toEqual([journeyStepGuard]);
  });

  it('AD-8: "requests/:requestId/data" lazy-loads UserDataComponent and is protected by journeyStepGuard', async () => {
    const data = findRoute('requests/:requestId/data');

    const loaded = await (data.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('UserDataComponent');
    expect(data.canActivate).toEqual([journeyStepGuard]);
  });

  it('AD-8: "email" lazy-loads VerifyEmailComponent and is protected by journeyStepGuard', async () => {
    const email = findRoute('email');

    const loaded = await (email.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('VerifyEmailComponent');
    expect(email.canActivate).toEqual([journeyStepGuard]);
  });

  it.each([
    ['requests', 'RequestsComponent'],
    ['no-requests', 'NoRequestsComponent'],
    ['request-unavailable', 'RequestUnavailableComponent'],
  ])('AD-8: "%s" lazy-loads %s', async (path, name) => {
    const loaded = await (findRoute(path).loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe(name);
  });

  it.each(['no-requests', 'request-unavailable'])('AD-8: "%s" has no step guard of the journey', (path) => {
    expect(findRoute(path).canActivate).not.toContain(journeyStepGuard);
  });

  it.each(['user-data', 'verify-email', 'offer'])('AD-8: the old route "%s" no longer exists', (path) => {
    expect(screens.find((r) => r.path === path)).toBeUndefined();
  });

  it('"incidents/sent" lazy-loads IncidentSentComponent, only after sending an incident, without a back button', async () => {
    const sent = findRoute('incidents/sent');

    const loaded = await (sent.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('IncidentSentComponent');
    expect(sent.canActivate).toEqual([incidentSentGuard]);
    expect(sent.resolve).toEqual({ responseTime: incidentResponseTimeResolver });
    expect(sent.data?.['back']).toBeUndefined();
    expect(findRoute('incidents').data?.['back']).toBe('');
  });

  it('"qr" (ruta demo retirada por AD-5) ya no existe', () => {
    expect(screens.find((r) => r.path === 'qr')).toBeUndefined();
  });

  it('EC-04: the ACME landing and identification routes are gone and any unknown path goes back to Inicio', () => {
    expect([...routes, ...screens].filter((r) => r.path?.startsWith('cliente') || r.path === 'identify')).toEqual([]);
    expect(routes[routes.length - 1]).toEqual({ path: '**', redirectTo: '' });
  });

  it('ES-01: every screen requires the configuration, except the unavailable one', () => {
    const parent = routes.find((r) => r.path === '' && r.children);
    expect(parent?.canActivateChild).toContain(configAvailableGuard);
    expect(routes.find((r) => r.path === 'error/config-unavailable')?.canActivate).toContain(configUnavailableGuard);
  });
});
