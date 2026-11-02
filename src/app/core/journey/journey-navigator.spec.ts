import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { JourneyNavigator, stepUrl } from './journey-navigator';
import { ApiProblemError, NETWORK_ERROR } from '../api/api-problem.error';
import { Journey, JourneyApi } from '../api/generated/journey';

describe('JourneyNavigator', () => {
  let getJourney: jest.Mock<Observable<Journey>>;
  let navigate: jest.SpyInstance;
  let navigator: JourneyNavigator;

  beforeEach(() => {
    getJourney = jest.fn();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: JourneyApi, useValue: { getJourney } }] });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    navigator = TestBed.inject(JourneyNavigator);
  });

  it.each<[Journey.StepEnum, string[]]>([
    ['identified', ['/', 'entitlement']],
    ['entitlement_confirmed', ['/', 'user-data']],
    ['offer_obtained', ['/', 'offer']],
  ])('EC-01: the step %s goes to %j', (step, url) => {
    expect(stepUrl({ state: 'in_progress', step })).toEqual(url);
  });

  it('a journey no longer in progress goes to Inicio', () => {
    expect(stepUrl({ state: 'withdrawn', step: 'entitlement_confirmed' })).toEqual(['/']);
  });

  it('ES-01: goes to the session expired case', async () => {
    await navigator.toSessionExpired();

    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'session-expired']);
  });

  it('AC-08: goes to the route of the step the service gives', async () => {
    getJourney.mockReturnValue(of({ state: 'in_progress', step: 'offer_obtained' }));

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/', 'offer']);
  });

  it('ES-01: if GET /journey answers 410, goes to the session expired case', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'session-expired']);
  });

  it('if GET /journey fails otherwise, goes to Inicio', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));

    await navigator.toCurrentStep();

    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
