import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { httpInterceptors } from './app.config';
import { ApiProblemError } from './core/api/api-problem.error';
import { JourneyInactivityService } from './core/journey/journey-inactivity.service';
import { JourneyNavigator } from './core/journey/journey-navigator';

/** Los interceptores encadenados tal como los registra la aplicación. */
describe('HTTP interceptors of the app', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let navigator: { toSessionExpired: jest.Mock; toCurrentStep: jest.Mock };
  let touch: jest.Mock;

  beforeEach(() => {
    navigator = { toSessionExpired: jest.fn().mockResolvedValue(true), toCurrentStep: jest.fn().mockResolvedValue(true) };
    touch = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors(httpInterceptors)),
        provideHttpClientTesting(),
        { provide: JourneyNavigator, useValue: navigator },
        { provide: JourneyInactivityService, useValue: { touch } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('run in this order, so the errors interceptor sees the translated ApiProblemError', () => {
    expect(httpInterceptors.map((interceptor) => interceptor.name)).toEqual([
      'journeyActivityInterceptor',
      'journeyErrorsInterceptor',
      'issuancePortalApiInterceptor',
    ]);
  });

  it('EC-05, ES-01: a 410 counts as activity, reaches the caller as ApiProblemError and shows the session expired case', async () => {
    const url = '/issuance-portal/api/v1/journey/confirmation';
    const call = firstValueFrom(http.post(url, {})).catch((error: unknown) => error);
    backend.expectOne(url).flush({ type: 'journey_closed', title: 'Journey closed', status: 410 }, { status: 410, statusText: 'Gone' });

    const error = await call;

    expect(touch).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect(navigator.toSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('AC-08: a 409 step_not_allowed goes to the step the service gives', async () => {
    const url = '/issuance-portal/api/v1/journey/offers';
    const call = firstValueFrom(http.post(url, {})).catch((error: unknown) => error);
    backend.expectOne(url).flush({ type: 'step_not_allowed', title: 'Step not allowed', status: 409 }, { status: 409, statusText: 'Conflict' });

    await call;

    expect(navigator.toCurrentStep).toHaveBeenCalledTimes(1);
  });
});
