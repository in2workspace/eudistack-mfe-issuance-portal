import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { pendingJourneyGuard } from './pending-journey.guard';

describe('pendingJourneyGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('always sends the holder back to Inicio', () => {
    const result = TestBed.runInInjectionContext(() =>
      pendingJourneyGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    const router = TestBed.inject(Router);
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });
});
