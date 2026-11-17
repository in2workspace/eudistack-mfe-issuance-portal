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

  it('EC-05: the return of the Verifier keeps code, state, error and iss', () => {
    expect(run('/callback?code=abc&state=xyz&iss=https%3A%2F%2Fverifier.example&session_state=s1')).toBe(true);
    expect(run('/callback?error=access_denied&error_description=cancelled&iss=https%3A%2F%2Fverifier.example')).toBe(true);
  });

  it('EC-05: the return of the Verifier still drops the parameters of the old demo', () => {
    expect(run('/callback?code=abc&state=xyz&u=eyJ9&identified=1')).toBe('/callback?code=abc&state=xyz');
  });

  it('EC-05: on any other route code goes too, even with the name of the callback in the query', () => {
    expect(run('/offer?code=abc&state=xyz')).toBe('/offer?state=xyz');
    expect(run('/user-data/callback?code=abc')).toBe('/user-data/callback');
  });
});
