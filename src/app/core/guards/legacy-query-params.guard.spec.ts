import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { legacyQueryParamsGuard } from './legacy-query-params.guard';

describe('legacyQueryParamsGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function run(url: string): boolean | string {
    const result = TestBed.runInInjectionContext(() =>
      legacyQueryParamsGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
  }

  it('lets an address without demo parameters through', () => {
    expect(run('/incidents?lang=en')).toBe(true);
  });

  it('AC-05: redirects to the same address without ?u=, ?code= and ?identified=', () => {
    expect(run('/?u=eyJ9&code=abc&identified=1')).toBe('/');
    expect(run('/user-data?lang=en&u=eyJ9')).toBe('/user-data?lang=en');
  });
});
