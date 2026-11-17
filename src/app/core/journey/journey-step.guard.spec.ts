import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { journeyStepGuard } from './journey-step.guard';
import { ApiProblemError, NETWORK_ERROR } from '../api/api-problem.error';
import { EmailVerification, Journey, JourneyApi, JourneyRequest } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { routes } from '../../app.routes';
import { SESSION_ACTIONS } from '../session/session-actions';

const DATA = 'requests/:requestId/data';
const QR = 'requests/:requestId/offer';

describe('journeyStepGuard', () => {
  let token: string | null;
  let getJourney: jest.Mock<Observable<Journey>>;
  let discardTokens: jest.Mock;
  let resumeLogin: jest.Mock;

  beforeEach(() => {
    token = 'access-token';
    getJourney = jest.fn();
    discardTokens = jest.fn();
    resumeLogin = jest.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => token },
        { provide: JourneyApi, useValue: { getJourney } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), resumeLogin, discardTokens } },
      ],
    });
  });

  const verification = (verified: boolean): EmailVerification => ({
    email: 'maria@example.org',
    verified,
    resend_available_at: '2026-11-11T10:03:00Z',
    sends_left: 2,
  });

  const IN_TEN_MINUTES = (): string => new Date(Date.now() + 600_000).toISOString();
  const available = (id: string): JourneyRequest => ({ id, status: 'available' });
  const saved = (id: string): JourneyRequest => ({ id, status: 'saved' });
  const notAvailable = (id: string): JourneyRequest => ({ id, status: 'not_available', not_available_reason: 'identity_mismatch' });
  const inOffer = (id: string, withOffer = true): JourneyRequest => ({
    id,
    status: 'in_offer',
    offer: withOffer
      ? { credential_offer_uri: 'openid-credential-offer://?credential_offer_uri=x', expires_at: IN_TEN_MINUTES() }
      : undefined,
  });

  /** Un recorrido con el correo verificado (por defecto) y las solicitudes dadas. */
  function journey(requests: JourneyRequest[], overrides: Partial<Journey> = {}): Observable<Journey> {
    return of({ state: 'in_progress', step: 'email_verified', email_verification: verification(true), requests, ...overrides });
  }

  async function run(path: string, requestId?: string, url = `/${path}`): Promise<true | false | string> {
    const route = {
      routeConfig: { path },
      paramMap: convertToParamMap(requestId === undefined ? {} : { requestId }),
    } as ActivatedRouteSnapshot;
    const result = await TestBed.runInInjectionContext(
      () => journeyStepGuard(route, { url } as RouterStateSnapshot) as Promise<boolean | UrlTree>,
    );
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
  }

  it('AD-8: protects Comprobación, Correo, Datos and QR of a request', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];

    for (const path of ['entitlement', 'email', DATA, QR]) {
      expect({ path, guards: screens.find((r) => r.path === path)?.canActivate }).toEqual({
        path,
        guards: [journeyStepGuard],
      });
    }
  });

  describe('lets the holder in when the journey allows the screen', () => {
    it('EC-01: Comprobación with no requests obtained yet', async () => {
      getJourney.mockReturnValue(of({ state: 'in_progress', step: 'identified' }));

      expect(await run('entitlement')).toBe(true);
    });

    it.each<[string, EmailVerification | undefined]>([
      ['no code sent yet (state 1)', undefined],
      ['a code pending (state 2)', verification(false)],
    ])('AC-21: Correo with %s', async (_name, email_verification) => {
      getJourney.mockReturnValue(journey([available('r1')], { step: 'entitlement_confirmed', email_verification }));

      expect(await run('email')).toBe(true);
    });

    it('decision 2 of EUD-358: Correo with a new code asked after verifying (step email_verified, not verified)', async () => {
      getJourney.mockReturnValue(journey([available('r1')], { email_verification: verification(false) }));

      expect(await run('email')).toBe(true);
    });

    it('AC-01: Solicitudes with the email verified', async () => {
      getJourney.mockReturnValue(journey([available('r1'), available('r2')]));

      expect(await run('requests')).toBe(true);
    });

    it('AC-02: Datos of an available request', async () => {
      getJourney.mockReturnValue(journey([available('r1'), available('r2')]));

      expect(await run(DATA, 'r2')).toBe(true);
    });

    it.each<[string, JourneyRequest]>([
      ['available (generating, it confirms)', available('r2')],
      ['in the process with an offer (reload)', inOffer('r2')],
      ['in the process with no offer (new code)', inOffer('r2', false)],
    ])('EC-06: QR of a request %s', async (_name, target) => {
      getJourney.mockReturnValue(journey([available('r1'), target], { state: 'completed', step: 'offer_obtained' }));

      expect(await run(QR, 'r2')).toBe(true);
    });
  });

  describe('EC-07: sends the holder to the step the journey says', () => {
    it.each<[string, string, JourneyRequest[], string]>([
      ['not available', DATA, [available('r1'), notAvailable('r2')], '/requests'],
      ['saved', DATA, [available('r1'), saved('r2')], '/requests'],
      ['not of the journey', DATA, [available('r1'), available('r3')], '/requests'],
      ['in the process (Datos is for available ones)', DATA, [available('r1'), inOffer('r2', false)], '/requests'],
      ['not available (QR)', QR, [available('r1'), notAvailable('r2')], '/requests'],
      ['saved (QR)', QR, [available('r1'), saved('r2')], '/requests'],
      ['not of the journey (QR)', QR, [available('r1'), available('r3')], '/requests'],
    ])('a link to the request %s: %s', async (_name, path, requests, target) => {
      getJourney.mockReturnValue(journey(requests, { state: 'completed', step: 'offer_obtained' }));

      expect(await run(path, 'r2')).toBe(target);
    });

    it('a link to the Datos of another request goes to the one the journey says, if it is the only one available', async () => {
      getJourney.mockReturnValue(journey([available('r1')]));

      expect(await run(DATA, 'r9')).toBe('/requests/r1/data');
    });

    it('a request with a current offer takes the holder to its QR from any other screen', async () => {
      getJourney.mockReturnValue(journey([saved('r1'), inOffer('r2')], { state: 'completed', step: 'offer_obtained' }));

      expect(await run('requests')).toBe(true);
      expect(await run(DATA, 'r1')).toBe('/requests/r2/offer');
    });
  });

  describe('AC-09: sends the holder to the step the journey says', () => {
    it.each<[string, string | undefined, Journey.StepEnum, EmailVerification | undefined, string]>([
      ['email', undefined, 'identified', undefined, '/entitlement'],
      ['requests', undefined, 'identified', undefined, '/entitlement'],
      [DATA, 'r1', 'identified', undefined, '/entitlement'],
      [QR, 'r1', 'identified', undefined, '/entitlement'],
      // El correo sin verificar: nada de solicitudes ni de emisión (AC-21, FR-13).
      ['requests', undefined, 'entitlement_confirmed', undefined, '/email'],
      ['requests', undefined, 'email_verified', verification(false), '/email'],
      [DATA, 'r1', 'entitlement_confirmed', verification(false), '/email'],
      [QR, 'r1', 'email_verified', verification(false), '/email'],
    ])('on %s (%s) with step %s and %j, goes to %s', async (path, requestId, step, email_verification, target) => {
      getJourney.mockReturnValue(journey([available('r1')], { step, email_verification }));

      expect(await run(path, requestId)).toBe(target);
    });

    it('with the email verified, Comprobación and Correo go to the single request Datos', async () => {
      getJourney.mockReturnValue(journey([available('r1')]));

      expect(await run('entitlement')).toBe('/requests/r1/data');
      expect(await run('email')).toBe('/requests/r1/data');
    });

    it('with the email verified and several requests, Comprobación and Correo go to Solicitudes', async () => {
      getJourney.mockReturnValue(journey([available('r1'), available('r2')]));

      expect(await run('entitlement')).toBe('/requests');
      expect(await run('email')).toBe('/requests');
    });
  });

  it.each<Journey.StepEnum>(['entitlement_confirmed', 'offer_obtained'])(
    'EC-01 (EUD-286): a withdrawn journey at step %s goes to Inicio',
    async (step) => {
      getJourney.mockReturnValue(journey([available('r1')], { state: 'withdrawn', step }));

      expect(await run(QR, 'r1')).toBe('/');
    },
  );

  it('AC-07: with no Access Token (the page was reloaded) tries the silent login, cancels the navigation and does not call the service', async () => {
    token = null;

    expect(await run(QR, 'r2')).toBe(false);
    expect(resumeLogin).toHaveBeenCalledTimes(1);
    expect(getJourney).not.toHaveBeenCalled();
  });

  it('EC-06: with no Access Token the silent login is told where to come back to, the request included', async () => {
    token = null;

    await run(DATA, 'r2', '/requests/r2/data');

    expect(resumeLogin).toHaveBeenCalledWith('/requests/r2/data');
  });

  it('AC-07: with an Access Token it does not start any login', async () => {
    getJourney.mockReturnValue(journey([available('r1')]));

    await run(DATA, 'r1');

    expect(resumeLogin).not.toHaveBeenCalled();
  });

  it('ES-02: a 401 goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('unauthenticated', 401, 'Unauthenticated')));

    expect(await run(DATA, 'r1')).toBe('/');
    expect(discardTokens).not.toHaveBeenCalled();
  });

  it('ES-01, EC-07, ES-08: a 410 journey_closed discards the tokens and goes to the session expired case', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));

    expect(await run(QR, 'r1')).toBe('/error/session-expired');
    expect(discardTokens).toHaveBeenCalledTimes(1);
  });

  it('any other failure goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));

    expect(await run(QR, 'r1')).toBe('/');
  });
});
