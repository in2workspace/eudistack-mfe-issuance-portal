import { TestBed } from '@angular/core/testing';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { Subject, of, throwError } from 'rxjs';
import { HolderAuthService } from './holder-auth.service';
import { OidcFlowStorage } from './oidc-flow-storage';

describe('HolderAuthService', () => {
  const CALLBACK = 'https://sandbox.example/issuance-portal/callback?code=abc&state=xyz';
  let oidc: { authorize: jest.Mock; checkAuth: jest.Mock; logoffLocal: jest.Mock; forceRefreshSession: jest.Mock };
  let flow: { clearFlow: jest.Mock; clear: jest.Mock };
  let service: HolderAuthService;

  function authenticated(userData: unknown, accessToken = 'access-token'): LoginResponse {
    return { isAuthenticated: true, userData, accessToken, idToken: 'id-token', configId: 'issuance-portal' };
  }

  beforeEach(() => {
    oidc = { authorize: jest.fn(), checkAuth: jest.fn(), logoffLocal: jest.fn(), forceRefreshSession: jest.fn() };
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

    const outcome = await service.completeLogin(CALLBACK);

    expect(outcome).toBe('authenticated');
    expect(oidc.checkAuth).toHaveBeenCalledWith(CALLBACK);
    expect(service.accessToken()).toBe('access-token');
    expect(service.givenName()).toBe('Maria');
    expect(flow.clearFlow).toHaveBeenCalled();
  });

  it('EC-08: an ID Token without given_name leaves the name empty and is no error', async () => {
    oidc.checkAuth.mockReturnValue(of(authenticated({ sub: 'x' })));

    const outcome = await service.completeLogin(CALLBACK);

    expect(outcome).toBe('authenticated');
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
    const outcome = await service.completeLogin(url);

    expect(outcome).toBe('failed');
    expect(oidc.checkAuth).not.toHaveBeenCalled();
    expect(service.accessToken()).toBeNull();
    expect(flow.clear).toHaveBeenCalled();
  });

  it('ES-04: a return the library does not validate (state, nonce, ID Token) keeps no token', async () => {
    oidc.checkAuth.mockReturnValue(
      of({ isAuthenticated: false, userData: null, accessToken: '', idToken: '', errorMessage: 'state does not match' } as LoginResponse),
    );

    const outcome = await service.completeLogin(CALLBACK);

    expect(outcome).toBe('failed');
    expect(service.accessToken()).toBeNull();
    expect(service.givenName()).toBe('');
    expect(oidc.logoffLocal).toHaveBeenCalled();
    expect(flow.clearFlow).toHaveBeenCalled();
  });

  it('ES-04: a failure while processing the return keeps no token', async () => {
    oidc.checkAuth.mockReturnValue(throwError(() => new Error('boom')));

    expect(await service.completeLogin(CALLBACK)).toBe('failed');
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

  it.each(['login_required', 'interaction_required'])(
    'AC-07: a return with %s means the silent login could not resolve: interaction is required and no token is kept',
    async (error) => {
      const outcome = await service.completeLogin(`https://sandbox.example/issuance-portal/callback?error=${error}&iss=x`);

      expect(outcome).toBe('interaction-required');
      expect(oidc.checkAuth).not.toHaveBeenCalled();
      expect(service.accessToken()).toBeNull();
      expect(flow.clearFlow).toHaveBeenCalled();
    },
  );

  it('AC-07: the silent login is an authorize with prompt=none', () => {
    service.loginSilently();

    expect(oidc.authorize).toHaveBeenCalledWith(undefined, { customParams: { prompt: 'none' } });
  });

  describe('renewal (AC-06, EC-06)', () => {
    const jwt = (claims: object) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`;
    const nowSeconds = () => Math.floor(Date.now() / 1000);

    async function login(accessToken: string, userData: unknown = { given_name: 'Maria' }): Promise<void> {
      oidc.checkAuth.mockReturnValue(of(authenticated(userData, accessToken)));
      await service.completeLogin(CALLBACK);
    }

    it('AC-06: renews with the Refresh Token, keeps the new Access Token and the name of the first ID Token', async () => {
      await login('old-token');
      oidc.forceRefreshSession.mockReturnValue(of(authenticated({}, 'new-token')));

      expect(await service.renew()).toBe(true);

      expect(service.accessToken()).toBe('new-token');
      expect(service.givenName()).toBe('Maria');
    });

    it('EC-06: a Refresh Token the Verifier does not know makes the renewal false', async () => {
      await login('old-token');
      oidc.forceRefreshSession.mockReturnValue(throwError(() => new Error('invalid_grant')));

      expect(await service.renew()).toBe(false);
    });

    it('EC-06: a renewal that does not authenticate is false', async () => {
      oidc.forceRefreshSession.mockReturnValue(
        of({ isAuthenticated: false, userData: null, accessToken: '', idToken: '' } as LoginResponse),
      );

      expect(await service.renew()).toBe(false);
    });

    it('concurrent renewals share one refresh, because the Refresh Token is single use', async () => {
      const refresh = new Subject<LoginResponse>();
      oidc.forceRefreshSession.mockReturnValue(refresh);

      const [a, b, c] = [service.renew(), service.renew(), service.renew()];
      refresh.next(authenticated({}, 'new-token'));
      refresh.complete();

      expect(await Promise.all([a, b, c])).toEqual([true, true, true]);
      expect(oidc.forceRefreshSession).toHaveBeenCalledTimes(1);
    });

    it('a later renewal refreshes again', async () => {
      oidc.forceRefreshSession.mockReturnValue(of(authenticated({}, 't')));

      await service.renew();
      await service.renew();

      expect(oidc.forceRefreshSession).toHaveBeenCalledTimes(2);
    });

    it('knows an Access Token is expired from its exp, with a margin', async () => {
      await login(jwt({ exp: nowSeconds() - 1 }));
      expect(service.isAccessTokenExpired()).toBe(true);

      await login(jwt({ exp: nowSeconds() + 2 }));
      expect(service.isAccessTokenExpired()).toBe(true);

      await login(jwt({ exp: nowSeconds() + 600 }));
      expect(service.isAccessTokenExpired()).toBe(false);
    });

    it('does not take as expired a token without a readable exp, nor the absence of token', async () => {
      expect(service.isAccessTokenExpired()).toBe(false);
      await login('opaque-token');
      expect(service.isAccessTokenExpired()).toBe(false);
    });

    it('goes to the Verifier once, discarding the session first, however many requests fail', async () => {
      await login('old-token');

      service.redirectToVerifier();
      service.redirectToVerifier();

      expect(service.accessToken()).toBeNull();
      expect(oidc.logoffLocal).toHaveBeenCalledTimes(1);
      expect(oidc.authorize).toHaveBeenCalledTimes(1);
    });
  });
});
