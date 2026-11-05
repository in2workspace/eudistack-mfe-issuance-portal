import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { journeyErrorsInterceptor } from './journey-errors.interceptor';
import { JourneyNavigator } from './journey-navigator';
import { ApiProblemError } from '../api/api-problem.error';
import { issuancePortalApiInterceptor } from '../api/issuance-portal-api.interceptor';

describe('journeyErrorsInterceptor', () => {
  const api = '/issuance-portal/api/v1';
  let http: HttpClient;
  let backend: HttpTestingController;
  let navigator: { toSessionExpired: jest.Mock; toCurrentStep: jest.Mock };

  beforeEach(() => {
    navigator = { toSessionExpired: jest.fn().mockResolvedValue(true), toCurrentStep: jest.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([journeyErrorsInterceptor, issuancePortalApiInterceptor])),
        provideHttpClientTesting(),
        { provide: JourneyNavigator, useValue: navigator },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Hace la llamada, responde con el Problem y devuelve el error que recibe quien llamó. */
  async function failWith(method: 'GET' | 'POST', url: string, type: string, status: number): Promise<unknown> {
    const call = firstValueFrom(http.request(method, url, { body: {} })).catch((error: unknown) => error);
    backend.expectOne({ method, url }).flush({ type, title: type, status }, { status, statusText: 'Error' });
    return call;
  }

  it('ES-01: a 410 journey_closed goes to the session expired case and still reaches the caller', async () => {
    const error = await failWith('POST', `${api}/journey/confirmation`, 'journey_closed', 410);

    expect(navigator.toSessionExpired).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect(error).toMatchObject({ type: 'journey_closed' });
  });

  it('AC-08: a 409 step_not_allowed goes to the step the service gives, with no error screen', async () => {
    const error = await failWith('POST', `${api}/journey/offers`, 'step_not_allowed', 409);

    expect(navigator.toCurrentStep).toHaveBeenCalledTimes(1);
    expect(navigator.toSessionExpired).not.toHaveBeenCalled();
    expect(error).toMatchObject({ type: 'step_not_allowed' });
  });

  it('EC-06: a 409 offer_not_renewable is left to the screen that called', async () => {
    const error = await failWith('POST', `${api}/journey/offers`, 'offer_not_renewable', 409);

    expect(navigator.toCurrentStep).not.toHaveBeenCalled();
    expect(navigator.toSessionExpired).not.toHaveBeenCalled();
    expect(error).toMatchObject({ type: 'offer_not_renewable' });
  });

  it('leaves GET /journey to the guard and the navigator, so they do not navigate twice', async () => {
    await failWith('GET', `${api}/journey`, 'journey_closed', 410);

    expect(navigator.toSessionExpired).not.toHaveBeenCalled();
  });

  it('a 410 on POST /journey/withdrawal is handled like any other call', async () => {
    await failWith('POST', `${api}/journey/withdrawal`, 'journey_closed', 410);

    expect(navigator.toSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not touch requests outside the service', async () => {
    const call = firstValueFrom(http.get('assets/i18n/es.json')).catch((error: unknown) => error);
    backend.expectOne('assets/i18n/es.json').flush({ type: 'journey_closed' }, { status: 410, statusText: 'Gone' });
    await call;

    expect(navigator.toSessionExpired).not.toHaveBeenCalled();
  });
});
