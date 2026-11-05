import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { JourneyInactivityService } from './journey-inactivity.service';
import { journeyActivityInterceptor } from './journey-activity.interceptor';
import { JourneyNavigator } from './journey-navigator';
import { ApiProblemError } from '../api/api-problem.error';
import { Journey, JourneyApi } from '../api/generated/journey';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';

describe('JourneyInactivityService', () => {
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  /** La comprobación se lanza a los 15 minutos más un minuto de margen. */
  const PROBE_AT = FIFTEEN_MINUTES + 60 * 1000;
  let token: string | null;
  let url: string;
  let getJourney: jest.Mock<Observable<Journey>>;
  let toSessionExpired: jest.Mock;
  let service: JourneyInactivityService;

  beforeEach(() => {
    jest.useFakeTimers();
    token = 'access-token';
    url = '/user-data';
    getJourney = jest.fn().mockReturnValue(of({ state: 'in_progress', step: 'entitlement_confirmed' }));
    toSessionExpired = jest.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([journeyActivityInterceptor])),
        provideHttpClientTesting(),
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => token },
        { provide: JourneyApi, useValue: { getJourney } },
        { provide: JourneyNavigator, useValue: { toSessionExpired } },
      ],
    });
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockImplementation(() => url);
    service = TestBed.inject(JourneyInactivityService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    jest.useRealTimers();
  });

  async function elapse(ms: number): Promise<void> {
    await jest.advanceTimersByTimeAsync(ms);
  }

  it('AC-02: after 15 minutes without calls on a step, a 410 from GET /journey shows the session expired case', async () => {
    getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));
    service.touch();

    await elapse(PROBE_AT);

    expect(getJourney).toHaveBeenCalledTimes(1);
    expect(toSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does nothing before the 15 minutes and the margin', async () => {
    service.touch();

    await elapse(PROBE_AT - 1);

    expect(getJourney).not.toHaveBeenCalled();
  });

  it('AC-02: does not probe at exactly 15 minutes, so the probe cannot renew a journey the service is about to retire', async () => {
    service.touch();

    await elapse(FIFTEEN_MINUTES);
    expect(getJourney).not.toHaveBeenCalled();

    await elapse(60 * 1000);
    expect(getJourney).toHaveBeenCalledTimes(1);
  });

  it('if the journey is still in progress, does not show the session expired case', async () => {
    service.touch();

    await elapse(PROBE_AT);

    expect(getJourney).toHaveBeenCalledTimes(1);
    expect(toSessionExpired).not.toHaveBeenCalled();
  });

  it('EC-05: every call to the portal service starts the 15 minutes again', async () => {
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    service.touch();
    await elapse(10 * 60 * 1000);

    http.post('/issuance-portal/api/v1/journey/offers', {}).subscribe();
    backend.expectOne('/issuance-portal/api/v1/journey/offers').flush({});
    await elapse(10 * 60 * 1000);

    expect(getJourney).not.toHaveBeenCalled();
    await elapse(6 * 60 * 1000);
    expect(getJourney).toHaveBeenCalledTimes(1);
  });

  it('a request outside the portal service does not count as activity', () => {
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    const touch = jest.spyOn(service, 'touch');

    http.get('assets/i18n/es.json').subscribe();
    backend.expectOne('assets/i18n/es.json').flush({});

    expect(touch).not.toHaveBeenCalled();
  });

  it.each(['/', '/incidents', '/error/not-entitled'])('EC-04: on %s there is no journey to watch', async (path) => {
    url = path;
    service.touch();

    await elapse(PROBE_AT);

    expect(getJourney).not.toHaveBeenCalled();
    expect(toSessionExpired).not.toHaveBeenCalled();
  });

  it('EC-04: without an Access Token there is no journey to watch', async () => {
    token = null;
    service.touch();

    await elapse(PROBE_AT);

    expect(getJourney).not.toHaveBeenCalled();
  });

  it.each(['/entitlement', '/offer'])('watches the step route %s too', async (path) => {
    url = path;
    service.touch();

    await elapse(PROBE_AT);

    expect(getJourney).toHaveBeenCalledTimes(1);
  });
});
