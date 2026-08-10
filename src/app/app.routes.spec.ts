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
});
