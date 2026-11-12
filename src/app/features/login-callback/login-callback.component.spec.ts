import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { httpInterceptors } from '../../app.config';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../../core/api/issuance-portal-api.interceptor';
import { provideIssuancePortalApi } from '../../core/api/issuance-portal-api.providers';
import { HolderAuthService } from '../../core/auth/holder-auth.service';
import { LoginCallbackComponent } from './login-callback.component';

describe('LoginCallbackComponent', () => {
  const JOURNEY_URL = '/issuance-portal/api/v1/journey';
  let auth: { completeLogin: jest.Mock; discard: jest.Mock; login: jest.Mock };
  let navigate: jest.SpyInstance;
  let backend: HttpTestingController;

  beforeEach(() => {
    auth = { completeLogin: jest.fn().mockResolvedValue('authenticated'), discard: jest.fn(), login: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(httpInterceptors)),
        provideHttpClientTesting(),
        provideIssuancePortalApi(),
        { provide: HolderAuthService, useValue: auth },
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => 'the-access-token' },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function open(): void {
    TestBed.createComponent(LoginCallbackComponent).detectChanges();
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('AC-02: opens the journey with the Access Token and goes to the step the service returns', async () => {
    open();
    await settle();

    const call = backend.expectOne(JOURNEY_URL);
    expect(call.request.method).toBe('POST');
    expect(call.request.headers.get('Authorization')).toBe('Bearer the-access-token');
    call.flush({ state: 'in_progress', step: 'identified' }, { status: 201, statusText: 'Created' });
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/', 'entitlement'], { replaceUrl: true });
    expect(auth.discard).not.toHaveBeenCalled();
  });

  it('AC-02: a journey that already exists (200) takes the holder to its step', async () => {
    open();
    await settle();

    backend.expectOne(JOURNEY_URL).flush(
      { state: 'in_progress', step: 'entitlement_confirmed', attestation: { type_name: 'DoctorID', fields: [], email_required: true } },
      { status: 200, statusText: 'OK' },
    );
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/', 'user-data'], { replaceUrl: true });
  });

  it('AC-03, ES-04: when the return is an error or does not validate, shows the identification not completed and does not open the journey', async () => {
    auth.completeLogin.mockResolvedValue('failed');

    open();
    await settle();

    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'identification-failed'], { replaceUrl: true });
    backend.expectNone(JOURNEY_URL);
  });

  it('shows the identification not completed and keeps no token when the service does not open the journey', async () => {
    open();
    await settle();

    backend.expectOne(JOURNEY_URL).flush(
      { type: 'unauthenticated', title: 'Unauthenticated', status: 401 },
      { status: 401, statusText: 'Unauthorized' },
    );
    await settle();

    expect(auth.discard).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'identification-failed'], { replaceUrl: true });
  });

  it('AC-07: when the silent login could not resolve, goes on with the interactive login and shows nothing', async () => {
    auth.completeLogin.mockResolvedValue('interaction-required');

    open();
    await settle();

    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    backend.expectNone(JOURNEY_URL);
  });

  it('design 3.2: a 503 config_unavailable shows the configuration error, discards the tokens and is not an identification failure', async () => {
    open();
    await settle();

    backend.expectOne(JOURNEY_URL).flush(
      { type: 'config_unavailable', title: 'Config unavailable', status: 503 },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await settle();

    expect(auth.discard).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/error/config-unavailable'], {
      replaceUrl: true,
      state: { serviceConfigUnavailable: true },
    });
  });
});
