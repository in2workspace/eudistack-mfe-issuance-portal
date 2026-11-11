import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { JourneyNavigator, stepUrl } from './journey-navigator';
import { ApiProblemError, NETWORK_ERROR } from '../api/api-problem.error';
import { EmailVerification, Journey, JourneyApi } from '../api/generated/journey';
import { SESSION_ACTIONS } from '../session/session-actions';
import { JourneyIssuanceStore } from './journey-issuance.store';

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

  it.each<[Journey.StepEnum, string[]]>([
    ['identified', ['/', 'entitlement']],
    ['entitlement_confirmed', ['/', 'user-data']],
    ['offer_obtained', ['/', 'offer']],
  ])('EC-01: the step %s with no email verification goes to %j', (step, url) => {
    expect(stepUrl({ state: 'in_progress', step })).toEqual(url);
  });

  describe('EUD-358: the screen follows email_verification, not the step', () => {
    const verification = (verified: boolean): EmailVerification => ({
      email: 'maria@example.org',
      verified,
      resend_available_at: '2026-11-11T10:03:00Z',
      sends_left: 2,
    });

    it.each<[Journey.StepEnum, boolean, string[]]>([
      ['entitlement_confirmed', false, ['/', 'verify-email']],
      ['email_verified', false, ['/', 'verify-email']],
      ['entitlement_confirmed', true, ['/', 'offer']],
      ['email_verified', true, ['/', 'offer']],
    ])('AC-09: step %s with verified=%s goes to %j', (step, verified, url) => {
      expect(stepUrl({ state: 'in_progress', step, email_verification: verification(verified) })).toEqual(url);
    });

    it('AC-09: the step email_verified with no email verification goes to Datos', () => {
      expect(stepUrl({ state: 'in_progress', step: 'email_verified' })).toEqual(['/', 'user-data']);
    });

    it('a completed journey with the offer obtained goes to QR whatever email_verification says', () => {
      expect(
        stepUrl({ state: 'completed', step: 'offer_obtained', email_verification: verification(false) }),
      ).toEqual(['/', 'offer']);
    });

    it('a withdrawn journey goes to Inicio even with a code pending', () => {
      expect(stepUrl({ state: 'withdrawn', step: 'email_verified', email_verification: verification(false) })).toEqual(['/']);
    });
  });

  it('a withdrawn journey goes to Inicio', () => {
    expect(stepUrl({ state: 'withdrawn', step: 'entitlement_confirmed' })).toEqual(['/']);
    expect(stepUrl({ state: 'withdrawn', step: 'offer_obtained' })).toEqual(['/']);
  });

  it('NFR-1 (EUD-286): expireSession forgets the call pending in QR', () => {
    const store = TestBed.inject(JourneyIssuanceStore);
    store.requestConfirmation();

    navigator.expireSession();

    expect(store.pendingCall()).toBeNull();
  });

  it('EC-01 (EUD-286): a completed journey with the offer obtained goes to QR', () => {
    expect(stepUrl({ state: 'completed', step: 'offer_obtained' })).toEqual(['/', 'offer']);
  });

  it('EC-01 (EUD-286): a 409 step_not_allowed on a completed journey goes to QR', async () => {
    getJourney.mockReturnValue(of({ state: 'completed', step: 'offer_obtained' }));

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/', 'offer']);
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
    getJourney.mockReturnValue(of({ state: 'in_progress', step: 'offer_obtained' }));

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/', 'offer']);
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
