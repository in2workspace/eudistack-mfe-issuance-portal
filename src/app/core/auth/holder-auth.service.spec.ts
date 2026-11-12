import { TestBed } from '@angular/core/testing';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { of, throwError } from 'rxjs';
import { HolderAuthService } from './holder-auth.service';
import { OidcFlowStorage } from './oidc-flow-storage';

describe('HolderAuthService', () => {
  const CALLBACK = 'https://sandbox.example/issuance-portal/callback?code=abc&state=xyz';
  let oidc: { authorize: jest.Mock; checkAuth: jest.Mock; logoffLocal: jest.Mock };
  let flow: { clearFlow: jest.Mock; clear: jest.Mock };
  let service: HolderAuthService;

  function authenticated(userData: unknown): LoginResponse {
    return { isAuthenticated: true, userData, accessToken: 'access-token', idToken: 'id-token', configId: 'issuance-portal' };
  }

  beforeEach(() => {
    oidc = { authorize: jest.fn(), checkAuth: jest.fn(), logoffLocal: jest.fn() };
    flow = { clearFlow: jest.fn(), clear: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: OidcSecurityService, useValue: oidc },
        { provide: OidcFlowStorage, useValue: flow },
      ],
    });
    service = TestBed.inject(HolderAuthService);
  });

  it('AC-01: login goes to the authorize of the Verifier', () => {
    service.login();

    expect(oidc.authorize).toHaveBeenCalledTimes(1);
  });

  it('AC-02: a valid return keeps the Access Token and the given name in memory', async () => {
    oidc.checkAuth.mockReturnValue(of(authenticated({ given_name: 'Maria', family_name: 'Holder' })));

    const ok = await service.completeLogin(CALLBACK);

    expect(ok).toBe(true);
    expect(oidc.checkAuth).toHaveBeenCalledWith(CALLBACK);
    expect(service.accessToken()).toBe('access-token');
    expect(service.givenName()).toBe('Maria');
    expect(flow.clearFlow).toHaveBeenCalled();
  });

  it('EC-08: an ID Token without given_name leaves the name empty and is no error', async () => {
    oidc.checkAuth.mockReturnValue(of(authenticated({ sub: 'x' })));

    const ok = await service.completeLogin(CALLBACK);

    expect(ok).toBe(true);
    expect(service.givenName()).toBe('');
  });

  it('EC-08: a given_name that is not a string is ignored', async () => {
    oidc.checkAuth.mockReturnValue(of(authenticated({ given_name: { a: 1 } })));

    await service.completeLogin(CALLBACK);

    expect(service.givenName()).toBe('');
  });

  it.each([
    'https://sandbox.example/issuance-portal/callback?error=access_denied&iss=https%3A%2F%2Fsandbox.example%2Fverifier',
    'https://sandbox.example/issuance-portal/callback?error=unmet_authentication_requirements',
    'https://sandbox.example/issuance-portal/callback?error=server_error&error_description=x',
  ])('AC-03: a return with an error (%s) is not completed, nothing is exchanged and no token is kept', async (url) => {
    const ok = await service.completeLogin(url);

    expect(ok).toBe(false);
    expect(oidc.checkAuth).not.toHaveBeenCalled();
    expect(service.accessToken()).toBeNull();
    expect(flow.clear).toHaveBeenCalled();
  });

  it('ES-04: a return the library does not validate (state, nonce, ID Token) keeps no token', async () => {
    oidc.checkAuth.mockReturnValue(
      of({ isAuthenticated: false, userData: null, accessToken: '', idToken: '', errorMessage: 'state does not match' } as LoginResponse),
    );

    const ok = await service.completeLogin(CALLBACK);

    expect(ok).toBe(false);
    expect(service.accessToken()).toBeNull();
    expect(service.givenName()).toBe('');
    expect(oidc.logoffLocal).toHaveBeenCalled();
    expect(flow.clearFlow).toHaveBeenCalled();
  });

  it('ES-04: a failure while processing the return keeps no token', async () => {
    oidc.checkAuth.mockReturnValue(throwError(() => new Error('boom')));

    expect(await service.completeLogin(CALLBACK)).toBe(false);
    expect(service.accessToken()).toBeNull();
  });

  it('AC-03: discard forgets the token and the name and clears the library storage', async () => {
    oidc.checkAuth.mockReturnValue(of(authenticated({ given_name: 'Maria' })));
    await service.completeLogin(CALLBACK);

    service.discard();

    expect(service.accessToken()).toBeNull();
    expect(service.givenName()).toBe('');
    expect(oidc.logoffLocal).toHaveBeenCalled();
    expect(flow.clear).toHaveBeenCalled();
  });
});
