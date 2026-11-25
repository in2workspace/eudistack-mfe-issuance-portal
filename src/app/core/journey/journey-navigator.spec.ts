import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { JourneyNavigator, hasCurrentOffer, isAvailable, isEmailVerified, requestOf, stepUrl } from './journey-navigator';
import { ApiProblemError, NETWORK_ERROR } from '../api/api-problem.error';
import { EmailVerification, Journey, JourneyApi, JourneyRequest, Offer } from '../api/generated/journey';
import { SESSION_ACTIONS } from '../session/session-actions';
import { JourneyIssuanceStore } from './journey-issuance.store';

const verification = (verified: boolean): EmailVerification => ({
  email: 'maria@example.org',
  verified,
  resend_available_at: '2026-11-11T10:03:00Z',
  sends_left: 2,
});

const IN_TEN_MINUTES = (): string => new Date(Date.now() + 600_000).toISOString();
const TEN_MINUTES_AGO = (): string => new Date(Date.now() - 600_000).toISOString();

const offer = (overrides: Partial<Offer> = {}): Offer => ({
  credential_offer_uri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffer%2F1',
  expires_at: IN_TEN_MINUTES(),
  ...overrides,
});

const request = (id: string, status: JourneyRequest.StatusEnum, extra: Partial<JourneyRequest> = {}): JourneyRequest => ({
  id,
  status,
  ...extra,
});

/** Un recorrido con el correo verificado y las solicitudes dadas. */
function verified(requests: JourneyRequest[], overrides: Partial<Journey> = {}): Journey {
  return { state: 'in_progress', step: 'email_verified', email_verification: verification(true), requests, ...overrides };
}

describe('JourneyNavigator', () => {
  let getJourney: jest.Mock<Observable<Journey>>;
  let navigate: jest.SpyInstance;
  let navigator: JourneyNavigator;
  let discardTokens: jest.Mock;

  beforeEach(() => {
    getJourney = jest.fn();
    discardTokens = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: JourneyApi, useValue: { getJourney } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), discardTokens } },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    navigator = TestBed.inject(JourneyNavigator);
  });

  describe('AD-8: the screen follows the requests and email_verification, not the step', () => {
    it('EC-01: a journey with no requests yet goes to Comprobación', () => {
      expect(stepUrl({ state: 'in_progress', step: 'identified' })).toEqual(['/', 'entitlement']);
    });

    it.each<[Journey.StepEnum, EmailVerification | undefined]>([
      ['entitlement_confirmed', undefined],
      ['entitlement_confirmed', verification(false)],
      // El paso no retrocede: con un código nuevo pedido, el paso sigue siendo email_verified (EUD-358, decisión 2).
      ['email_verified', verification(false)],
    ])('AC-21: step %s with the email not verified (%j) goes to Correo', (step, email_verification) => {
      expect(
        stepUrl({ state: 'in_progress', step, email_verification, requests: [request('r1', 'available')] }),
      ).toEqual(['/', 'email']);
    });

    it('AC-02: with the email verified and a single request, available, goes to its Datos', () => {
      expect(stepUrl(verified([request('r1', 'available')]))).toEqual(['/', 'requests', 'r1', 'data']);
    });

    it('AC-01: with the email verified and several requests goes to Solicitudes', () => {
      expect(stepUrl(verified([request('r1', 'available'), request('r2', 'available')]))).toEqual(['/', 'requests']);
    });

    it('EC-08: two requests, only one available, still goes to Solicitudes: the list shows what is wrong with the other', () => {
      expect(
        stepUrl(verified([request('r1', 'available'), request('r2', 'not_available', { not_available_reason: 'identity_mismatch' })])),
      ).toEqual(['/', 'requests']);
    });

    it.each<JourneyRequest['status']>(['saved', 'not_available'])(
      'with the email verified and a single request %s goes to Solicitudes, not to Datos',
      (status) => {
        expect(stepUrl(verified([request('r1', status)], { state: 'completed', step: 'offer_obtained' }))).toEqual(['/', 'requests']);
      },
    );

    it('with the email verified and no request in the journey goes to Solicitudes', () => {
      expect(stepUrl(verified([]))).toEqual(['/', 'requests']);
    });

    it('a request with a current offer goes to its QR', () => {
      expect(
        stepUrl(
          verified([request('r1', 'saved'), request('r2', 'in_offer', { offer: offer() }), request('r3', 'available')], {
            state: 'completed',
            step: 'offer_obtained',
          }),
        ),
      ).toEqual(['/', 'requests', 'r2', 'offer']);
    });

    it('a request whose offer has expired does not take the holder to its QR', () => {
      expect(
        stepUrl(
          verified([request('r1', 'in_offer', { offer: offer({ expires_at: TEN_MINUTES_AGO() }) }), request('r2', 'available')], {
            state: 'completed',
            step: 'offer_obtained',
          }),
        ),
      ).toEqual(['/', 'requests']);
    });

    it('the onboarding expiry, earlier than the offer one, is the one that counts', () => {
      const expiredTicket = offer({ onboarding_url: 'https://wallet.example/t/abc', onboarding_expires_at: TEN_MINUTES_AGO() });

      expect(hasCurrentOffer(request('r1', 'in_offer', { offer: expiredTicket }))).toBe(false);
    });

    it('a completed journey with the first offer delivered stays active', () => {
      expect(stepUrl(verified([request('r1', 'saved'), request('r2', 'available')], { state: 'completed', step: 'offer_obtained' }))).toEqual([
        '/',
        'requests',
      ]);
    });

    it('a withdrawn journey goes to Inicio, even with a code pending', () => {
      expect(stepUrl({ state: 'withdrawn', step: 'email_verified', email_verification: verification(false) })).toEqual(['/']);
      expect(stepUrl({ state: 'withdrawn', step: 'offer_obtained' })).toEqual(['/']);
    });
  });

  describe('request helpers', () => {
    const journey = verified([request('r1', 'available'), request('r2', 'saved')]);

    it('requestOf finds a request of the journey by its id and nothing else', () => {
      expect(requestOf(journey, 'r2')?.status).toBe('saved');
      expect(requestOf(journey, 'r9')).toBeUndefined();
      expect(requestOf(journey, null)).toBeUndefined();
      expect(requestOf({ state: 'in_progress', step: 'identified' }, 'r1')).toBeUndefined();
    });

    it('isAvailable is true only for an available request', () => {
      expect(isAvailable(request('r1', 'available'))).toBe(true);
      expect(isAvailable(request('r1', 'in_offer'))).toBe(false);
      expect(isAvailable(undefined)).toBe(false);
    });

    it('isEmailVerified follows email_verification.verified', () => {
      expect(isEmailVerified(journey)).toBe(true);
      expect(isEmailVerified({ ...journey, email_verification: verification(false) })).toBe(false);
      expect(isEmailVerified({ ...journey, email_verification: undefined })).toBe(false);
    });
  });

  it('NFR-1 (EUD-286): expireSession forgets the call pending in QR', () => {
    const store = TestBed.inject(JourneyIssuanceStore);
    store.requestConfirmation('r1');

    navigator.expireSession();

    expect(store.pending()).toBeNull();
  });

  it('EC-01 (EUD-286): a 409 step_not_allowed on a completed journey goes to the step the requests say', async () => {
    getJourney.mockReturnValue(
      of(verified([request('r1', 'in_offer', { offer: offer() })], { state: 'completed', step: 'offer_obtained' })),
    );

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/', 'requests', 'r1', 'offer']);
  });

  it('ES-01, EC-07: goes to the session expired case after discarding the tokens', async () => {
    await navigator.toSessionExpired();

    expect(discardTokens).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'session-expired']);
    expect(discardTokens.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });

  it('EC-07: expireSession discards the tokens and gives the session expired address', () => {
    expect(navigator.expireSession()).toEqual(['/', 'error', 'session-expired']);
    expect(discardTokens).toHaveBeenCalledTimes(1);
  });

  it('AC-08: goes to the route of the step the service gives', async () => {
    getJourney.mockReturnValue(of({ state: 'in_progress', step: 'entitlement_confirmed' }));

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/', 'email']);
  });

  it('ES-01: if GET /journey answers 410, goes to the session expired case', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));

    await navigator.toCurrentStep();

    expect(discardTokens).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'session-expired']);
  });

  it('if GET /journey fails otherwise, goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
