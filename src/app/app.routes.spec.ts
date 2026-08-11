import { Route } from '@angular/router';
import { routes } from './app.routes';

describe('routes', () => {
  function findRoute(path: string): Route {
    const route = routes.find((r) => r.path === path);
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

  it('"offer" lazy-loads CredentialOfferComponent and is protected by authGuard (EUD-163, AD-5)', async () => {
    const offer = findRoute('offer');

    const loaded = await (offer.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('CredentialOfferComponent');
    expect(offer.canActivate).toBeDefined();
    expect(offer.canActivate?.length).toBeGreaterThan(0);
  });

  it('"qr" (ruta demo retirada por AD-5) ya no existe', () => {
    expect(routes.find((r) => r.path === 'qr')).toBeUndefined();
  });
});
