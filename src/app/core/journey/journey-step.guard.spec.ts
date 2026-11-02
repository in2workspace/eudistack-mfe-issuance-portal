import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { journeyStepGuard } from './journey-step.guard';
import { ApiProblemError, NETWORK_ERROR } from '../api/api-problem.error';
import { Journey, JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { routes } from '../../app.routes';

describe('journeyStepGuard', () => {
  let token: string | null;
  let getJourney: jest.Mock<Observable<Journey>>;

  beforeEach(() => {
    token = 'access-token';
    getJourney = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => token },
        { provide: JourneyApi, useValue: { getJourney } },
      ],
    });
  });

  function journey(step: Journey.StepEnum, state: Journey.StateEnum = 'in_progress'): Observable<Journey> {
    return of({ state, step });
  }

  async function run(path: string): Promise<true | string> {
    const route = { routeConfig: { path } } as ActivatedRouteSnapshot;
    const result = await TestBed.runInInjectionContext(
      () => journeyStepGuard(route, {} as RouterStateSnapshot) as Promise<boolean | UrlTree>,
    );
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as true);
  }

  it('protects the Datos and QR routes', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];

    expect(screens.find((r) => r.path === 'user-data')?.canActivate).toEqual([journeyStepGuard]);
    expect(screens.find((r) => r.path === 'offer')?.canActivate).toEqual([journeyStepGuard]);
  });

  it.each<[string, Journey.StepEnum]>([
    ['entitlement', 'identified'],
    ['user-data', 'entitlement_confirmed'],
    ['offer', 'entitlement_confirmed'],
    ['offer', 'offer_obtained'],
  ])('EC-01: lets the holder into %s with step %s', async (path, step) => {
    getJourney.mockReturnValue(journey(step));

    expect(await run(path)).toBe(true);
  });

  it.each<[string, Journey.StepEnum, string]>([
    ['user-data', 'identified', '/entitlement'],
    ['offer', 'identified', '/entitlement'],
    ['entitlement', 'entitlement_confirmed', '/user-data'],
    ['user-data', 'offer_obtained', '/offer'],
    ['entitlement', 'offer_obtained', '/offer'],
  ])('AC-09: on %s with step %s, goes to %s', async (path, step, target) => {
    getJourney.mockReturnValue(journey(step));

    expect(await run(path)).toBe(target);
  });

  it.each<Journey.StateEnum>(['completed', 'withdrawn'])('a %s journey goes to Inicio', async (state) => {
    getJourney.mockReturnValue(journey('offer_obtained', state));

    expect(await run('offer')).toBe('/');
  });

  it('AC-01, ES-02: with no Access Token goes to Inicio without calling the service', async () => {
    token = null;

    expect(await run('offer')).toBe('/');
    expect(getJourney).not.toHaveBeenCalled();
  });

  it('ES-02: a 401 goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('unauthenticated', 401, 'Unauthenticated')));

    expect(await run('user-data')).toBe('/');
  });

  it('ES-01: a 410 journey_closed goes to the session expired case', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));

    expect(await run('offer')).toBe('/error/session-expired');
  });

  it('any other failure goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));

    expect(await run('offer')).toBe('/');
  });
});
