import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { httpInterceptors } from '../../app.config';
import { ApiProblemError } from '../api/api-problem.error';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { JourneyInactivityService } from '../journey/journey-inactivity.service';
import { JourneyNavigator } from '../journey/journey-navigator';
import { HolderAuthService } from './holder-auth.service';

describe('tokenRenewalInterceptor', () => {
  const URL = '/issuance-portal/api/v1/journey/confirmation';
  let token: string;
  let expired: boolean;
  let renew: jest.Mock<Promise<boolean>>;
  let redirectToVerifier: jest.Mock<boolean>;
  let confirmSession: jest.Mock;
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    token = 'old-token';
    expired = false;
    renew = jest.fn(async () => {
      token = 'new-token';
      expired = false;
      return true;
    });
    redirectToVerifier = jest.fn(() => true);
    confirmSession = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(httpInterceptors)),
        provideHttpClientTesting(),
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => token },
        { provide: HolderAuthService, useValue: { isAccessTokenExpired: () => expired, renew, redirectToVerifier, confirmSession } },
        { provide: JourneyNavigator, useValue: { toSessionExpired: jest.fn(), toCurrentStep: jest.fn() } },
        { provide: JourneyInactivityService, useValue: { touch: jest.fn() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const unauthorized = { type: 'unauthenticated', title: 'Unauthenticated', status: 401 };
  const unauthorizedOptions = { status: 401, statusText: 'Unauthorized' };

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('AC-06: a 401 renews the token and repeats the request once with the new one, with no error for the caller', async () => {
    const result = firstValueFrom(http.post(URL, {}));

    const first = backend.expectOne(URL);
    expect(first.request.headers.get('Authorization')).toBe('Bearer old-token');
    first.flush(unauthorized, unauthorizedOptions);
    await tick();

    const retry = backend.expectOne(URL);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush({ ok: true });
    expect(await result).toEqual({ ok: true });
    expect(renew).toHaveBeenCalledTimes(1);
    expect(redirectToVerifier).not.toHaveBeenCalled();
  });

  it('AC-06: an Access Token already expired is renewed before sending, so the request goes once with the new one', async () => {
    expired = true;
    const result = firstValueFrom(http.post(URL, {}));
    await tick();

    const call = backend.expectOne(URL);
    expect(call.request.headers.get('Authorization')).toBe('Bearer new-token');
    call.flush({ ok: true });

    expect(await result).toEqual({ ok: true });
    expect(renew).toHaveBeenCalledTimes(1);
  });

  it('EC-06: when the token cannot be renewed the holder goes to the Verifier, the request stays unanswered and no error is thrown', async () => {
    renew.mockResolvedValue(false);
    const next = jest.fn();
    const error = jest.fn();
    http.post(URL, {}).subscribe({ next, error });

    backend.expectOne(URL).flush(unauthorized, unauthorizedOptions);
    await tick();

    backend.expectNone(URL);
    expect(redirectToVerifier).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('a 401 that repeats after renewing goes to the Verifier and does not loop', async () => {
    const error = jest.fn();
    http.post(URL, {}).subscribe({ error });

    backend.expectOne(URL).flush(unauthorized, unauthorizedOptions);
    await tick();
    backend.expectOne(URL).flush(unauthorized, unauthorizedOptions);
    await tick();

    backend.expectNone(URL);
    expect(renew).toHaveBeenCalledTimes(1);
    expect(redirectToVerifier).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('an expired token that cannot be renewed does not even send the request', async () => {
    expired = true;
    renew.mockResolvedValue(false);
    http.post(URL, {}).subscribe();
    await tick();

    backend.expectNone(URL);
    expect(redirectToVerifier).toHaveBeenCalledTimes(1);
  });

  it('a failure that is not a 401 reaches the caller untouched and does not renew', async () => {
    const result = firstValueFrom(http.post(URL, {})).catch((error: unknown) => error);

    backend.expectOne(URL).flush({ type: 'invalid_code', title: 'Invalid code', status: 400 }, { status: 400, statusText: 'Bad Request' });

    expect(await result).toBeInstanceOf(ApiProblemError);
    expect(renew).not.toHaveBeenCalled();
  });

  it('POST /journey is not renewed: a 401 there reaches the callback as an error', async () => {
    const result = firstValueFrom(http.post('/issuance-portal/api/v1/journey', {})).catch((error: unknown) => error);

    backend.expectOne('/issuance-portal/api/v1/journey').flush(unauthorized, unauthorizedOptions);

    expect(await result).toBeInstanceOf(ApiProblemError);
    expect(renew).not.toHaveBeenCalled();
    expect(redirectToVerifier).not.toHaveBeenCalled();
  });

  it('AC-04, B2: GET /config goes without the token and a 401 there does not renew nor go to the Verifier', async () => {
    const result = firstValueFrom(http.get('/issuance-portal/api/v1/config')).catch((error: unknown) => error);

    const call = backend.expectOne('/issuance-portal/api/v1/config');
    expect(call.request.headers.has('Authorization')).toBe(false);
    call.flush(unauthorized, unauthorizedOptions);

    expect(await result).toBeInstanceOf(ApiProblemError);
    expect(renew).not.toHaveBeenCalled();
    expect(redirectToVerifier).not.toHaveBeenCalled();
  });

  it('W4: when the Verifier trip is not allowed (a second failure inside the window) shows identification-failed, with no loop', async () => {
    renew.mockResolvedValue(false);
    redirectToVerifier.mockReturnValue(false);
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const error = jest.fn();
    http.post(URL, {}).subscribe({ error });

    backend.expectOne(URL).flush(unauthorized, unauthorizedOptions);
    await tick();

    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'identification-failed']);
    expect(error).not.toHaveBeenCalled();
  });

  it('W4: a successful call confirms the session, so the trip counter is cleared', async () => {
    const result = firstValueFrom(http.post(URL, {}));
    backend.expectOne(URL).flush({ ok: true });
    await result;

    expect(confirmSession).toHaveBeenCalledTimes(1);
  });

  it('W4: a call that succeeds after the renewal also confirms the session', async () => {
    const result = firstValueFrom(http.post(URL, {}));
    backend.expectOne(URL).flush(unauthorized, unauthorizedOptions);
    await tick();
    backend.expectOne(URL).flush({ ok: true });
    await result;

    expect(confirmSession).toHaveBeenCalledTimes(1);
  });

  it('calls outside the service and the public incident are not renewed', async () => {
    const outside = firstValueFrom(http.get('/assets/i18n/es.json')).catch((error: unknown) => error);
    backend.expectOne('/assets/i18n/es.json').flush('', { status: 401, statusText: 'Unauthorized' });
    await outside;
    const incident = firstValueFrom(http.post('/issuance-portal/api/v1/incidents', {})).catch((error: unknown) => error);
    backend.expectOne('/issuance-portal/api/v1/incidents').flush(unauthorized, unauthorizedOptions);
    await incident;

    expect(renew).not.toHaveBeenCalled();
    expect(redirectToVerifier).not.toHaveBeenCalled();
  });
});
