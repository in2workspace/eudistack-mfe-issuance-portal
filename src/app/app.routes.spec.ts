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

  it('redirects the empty path to "portal"', () => {
    const root = findRoute('');

    expect(root.redirectTo).toBe('portal');
    expect(root.pathMatch).toBe('full');
  });

  it('"portal" lazy-loads IssuanceInfoComponent (EUD-162 entry point)', async () => {
    const portal = findRoute('portal');

    const loaded = await (portal.loadComponent as () => Promise<unknown>)();

    expect((loaded as { name: string }).name).toBe('IssuanceInfoComponent');
  });
});
