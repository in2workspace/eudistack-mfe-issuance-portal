import { Route } from '@angular/router';
import { routes } from './app.routes';
import { configAvailableGuard, configUnavailableGuard } from './core/guards/config-available.guard';

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

  it('"offer" lazy-loads CredentialOfferComponent and is protected by pendingJourneyGuard until EUD-287', async () => {
    const offer = findRoute('offer');

    const loaded = await (offer.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('CredentialOfferComponent');
    expect(offer.canActivate).toBeDefined();
    expect(offer.canActivate?.length).toBeGreaterThan(0);
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
    expect(routes.find((r) => r.path === 'unavailable')?.canActivate).toContain(configUnavailableGuard);
  });
});
