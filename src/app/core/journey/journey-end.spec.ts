import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { httpInterceptors } from '../../app.config';
import { ApiProblemError } from '../api/api-problem.error';
import { JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { HolderAuthService } from '../auth/holder-auth.service';
import { SESSION_ACTIONS } from '../session/session-actions';
import { JourneyInactivityService } from './journey-inactivity.service';

/**
 * AC-08, ES-05: cualquier 410 `journey_closed` acaba el recorrido y descarta
 * los tokens, venga de una llamada o del temporizador de inactividad (la
 * guarda de los pasos lo tiene en `journey-step.guard.spec.ts`). Con el
 * navegador de recorridos y los interceptores reales.
 */
describe('The end of the journey discards the tokens', () => {
  let discardTokens: jest.Mock;
  let navigate: jest.SpyInstance;
  let backend: HttpTestingController;
  let http: HttpClient;
  let getJourney: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    discardTokens = jest.fn();
    getJourney = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(httpInterceptors)),
        provideHttpClientTesting(),
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => 'access-token' },
        { provide: HolderAuthService, useValue: { isAccessTokenExpired: () => false, renew: jest.fn(), redirectToVerifier: jest.fn() } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), resumeLogin: jest.fn(), discardTokens } },
        { provide: JourneyApi, useValue: { getJourney } },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    backend = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    TestBed.inject(JourneyInactivityService).ngOnDestroy();
    jest.useRealTimers();
  });

  it('ES-05: a 410 journey_closed on any call of the journey discards the tokens and shows the session expired case', async () => {
    const url = '/issuance-portal/api/v1/entitlement';
    const call = firstValueFrom(http.post(url, {})).catch((error: unknown) => error);

    backend.expectOne(url).flush({ type: 'journey_closed', title: 'Journey closed', status: 410 }, { status: 410, statusText: 'Gone' });
    await call;

    expect(discardTokens).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'session-expired']);
  });

  it('AC-08: a 410 found by the inactivity timer discards the tokens and shows the session expired case', async () => {
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/user-data');
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));

    TestBed.inject(JourneyInactivityService).touch();
    await jest.advanceTimersByTimeAsync(JourneyInactivityService.INACTIVITY_MS + JourneyInactivityService.PROBE_MARGIN_MS);

    expect(discardTokens).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'session-expired']);
  });

  it('a 409 step_not_allowed goes back to the step and keeps the tokens: the journey goes on', async () => {
    getJourney.mockReturnValue(of({ state: 'in_progress', step: 'entitlement_confirmed' }));
    const url = '/issuance-portal/api/v1/journey/offers';
    const call = firstValueFrom(http.post(url, {})).catch((error: unknown) => error);

    backend.expectOne(url).flush({ type: 'step_not_allowed', title: 'Step not allowed', status: 409 }, { status: 409, statusText: 'Conflict' });
    await call;

    expect(discardTokens).not.toHaveBeenCalled();
  });
});
