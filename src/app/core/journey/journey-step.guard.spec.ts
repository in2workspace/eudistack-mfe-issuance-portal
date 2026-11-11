import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { journeyStepGuard } from './journey-step.guard';
import { ApiProblemError, NETWORK_ERROR } from '../api/api-problem.error';
import { Journey, JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { routes } from '../../app.routes';
import { SESSION_ACTIONS } from '../session/session-actions';

describe('journeyStepGuard', () => {
  let token: string | null;
  let getJourney: jest.Mock<Observable<Journey>>;
  let discardTokens: jest.Mock;

  beforeEach(() => {
    token = 'access-token';
    getJourney = jest.fn();
    discardTokens = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => token },
        { provide: JourneyApi, useValue: { getJourney } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), discardTokens } },
      ],
    });
  });

  function journey(
    step: Journey.StepEnum,
    state: Journey.StateEnum = 'in_progress',
    verified?: boolean,
  ): Observable<Journey> {
    const email_verification =
      verified === undefined
        ? undefined
        : { email: 'maria@example.org', verified, resend_available_at: '2026-11-11T10:03:00Z', sends_left: 2 };
    return of({ state, step, email_verification });
  }

  async function run(path: string): Promise<true | string> {
    const route = { routeConfig: { path } } as ActivatedRouteSnapshot;
    const result = await TestBed.runInInjectionContext(
      () => journeyStepGuard(route, {} as RouterStateSnapshot) as Promise<boolean | UrlTree>,
    );
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as true);
  }

  it('protects the Datos, Verificar correo and QR routes', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];

    expect(screens.find((r) => r.path === 'user-data')?.canActivate).toEqual([journeyStepGuard]);
    expect(screens.find((r) => r.path === 'verify-email')?.canActivate).toEqual([journeyStepGuard]);
    expect(screens.find((r) => r.path === 'offer')?.canActivate).toEqual([journeyStepGuard]);
  });

  it.each<[string, Journey.StepEnum, boolean | undefined]>([
    ['entitlement', 'identified', undefined],
    ['user-data', 'entitlement_confirmed', undefined],
    ['verify-email', 'entitlement_confirmed', false],
    ['offer', 'entitlement_confirmed', true],
    ['offer', 'email_verified', true],
    ['offer', 'offer_obtained', undefined],
    // Cambiar el correo y atrás desde Verificar correo vuelven a Datos, con el correo verificado o no (AC-07).
    ['user-data', 'entitlement_confirmed', false],
    ['user-data', 'email_verified', true],
    ['user-data', 'email_verified', false],
    // El paso no retrocede: con un código nuevo pedido, el paso sigue siendo email_verified (decisión 2).
    ['verify-email', 'email_verified', false],
  ])('EC-01: lets the holder into %s with step %s and verified=%s', async (path, step, verified) => {
    getJourney.mockReturnValue(journey(step, 'in_progress', verified));

    expect(await run(path)).toBe(true);
  });

  it.each<[string, Journey.StepEnum, boolean | undefined, string]>([
    ['user-data', 'identified', undefined, '/entitlement'],
    ['offer', 'identified', undefined, '/entitlement'],
    ['verify-email', 'identified', undefined, '/entitlement'],
    ['entitlement', 'entitlement_confirmed', undefined, '/user-data'],
    ['entitlement', 'entitlement_confirmed', false, '/verify-email'],
    ['entitlement', 'email_verified', true, '/offer'],
    ['user-data', 'offer_obtained', undefined, '/offer'],
    ['entitlement', 'offer_obtained', undefined, '/offer'],
    ['verify-email', 'offer_obtained', undefined, '/offer'],
    // AC-09: sin código pendiente no hay nada que verificar.
    ['verify-email', 'entitlement_confirmed', undefined, '/user-data'],
    ['verify-email', 'email_verified', true, '/offer'],
    // AC-01: no se pasa a QR sin introducir el código.
    ['offer', 'entitlement_confirmed', undefined, '/user-data'],
    ['offer', 'entitlement_confirmed', false, '/verify-email'],
    ['offer', 'email_verified', false, '/verify-email'],
  ])('AC-09: on %s with step %s and verified=%s, goes to %s', async (path, step, verified, target) => {
    getJourney.mockReturnValue(journey(step, 'in_progress', verified));

    expect(await run(path)).toBe(target);
  });

  it('EC-01 (EUD-286): a completed journey with the offer obtained stays in QR', async () => {
    getJourney.mockReturnValue(journey('offer_obtained', 'completed'));

    expect(await run('offer')).toBe(true);
  });

  it.each(['entitlement', 'user-data', 'verify-email'])('EC-01 (EUD-286): a completed journey on %s goes to QR', async (path) => {
    getJourney.mockReturnValue(journey('offer_obtained', 'completed'));

    expect(await run(path)).toBe('/offer');
  });

  it.each<Journey.StepEnum>(['entitlement_confirmed', 'offer_obtained'])(
    'EC-01 (EUD-286): a withdrawn journey at step %s goes to Inicio',
    async (step) => {
      getJourney.mockReturnValue(journey(step, 'withdrawn'));

      expect(await run('offer')).toBe('/');
    },
  );

  it('AC-01, ES-02: with no Access Token goes to Inicio without calling the service', async () => {
    token = null;

    expect(await run('offer')).toBe('/');
    expect(getJourney).not.toHaveBeenCalled();
  });

  it('ES-02: a 401 goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('unauthenticated', 401, 'Unauthenticated')));

    expect(await run('user-data')).toBe('/');
    expect(discardTokens).not.toHaveBeenCalled();
  });

  it('ES-01, EC-07: a 410 journey_closed discards the tokens and goes to the session expired case', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));

    expect(await run('offer')).toBe('/error/session-expired');
    expect(discardTokens).toHaveBeenCalledTimes(1);
  });

  it('any other failure goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));

    expect(await run('offer')).toBe('/');
  });
});
