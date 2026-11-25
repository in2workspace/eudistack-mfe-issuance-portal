import { webcrypto } from 'node:crypto';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { httpInterceptors } from '../../app.config';
import { ISSUANCE_PORTAL_ACCESS_TOKEN } from '../api/issuance-portal-api.interceptor';
import { SESSION_ACTIONS } from '../session/session-actions';
import { PortalConfig } from '../api/generated/journey';
import { PortalConfigService } from '../config/portal-config.service';
import { HolderAuthService } from './holder-auth.service';
import { provideHolderAuth } from './holder-auth.providers';

describe('provideHolderAuth', () => {
  // PKCE S256 necesita `crypto.subtle`, que jsdom no trae.
  beforeAll(() => Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true }));

  const origin = window.location.origin;
  let backend: HttpTestingController;
  let originalTenant: string;

  beforeEach(() => {
    originalTenant = environment.tenant;
    environment.tenant = 'sandbox';
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors(httpInterceptors)),
        provideHttpClientTesting(),
        provideHolderAuth(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.tenant = originalTenant;
  });

  /** Responde al descubrimiento del Verifier, que la librería pide al cargar su configuración. */
  async function answerDiscovery(): Promise<void> {
    const discovery = `${origin}/verifier/.well-known/openid-configuration`;
    let requests = backend.match(discovery);
    for (let attempt = 0; attempt < 20 && requests.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve));
      requests = backend.match(discovery);
    }
    expect(requests).toHaveLength(1);
    requests[0].flush({
      issuer: `${origin}/verifier`,
      authorization_endpoint: `${origin}/verifier/oidc/authorize`,
      token_endpoint: `${origin}/verifier/oidc/token`,
      jwks_uri: `${origin}/verifier/oidc/jwks`,
    });
  }

  /**
   * La URL de `authorize` a la que la librería llevaría al titular cuando
   * `HolderAuthService` inicia el login (`go`): se captura en lugar de navegar.
   */
  async function authorizeUrl(go: (auth: HolderAuthService) => void = (auth) => auth.login()): Promise<string> {
    const auth = TestBed.inject(HolderAuthService);
    const target = new Promise<string>((resolve) => {
      jest.spyOn(auth, 'navigateTo').mockImplementation(resolve);
    });
    go(auth);
    await answerDiscovery();
    return target;
  }

  it('AC-01: the authorize URL of the Verifier carries the client, the scope, the claims, PKCE, state and nonce', async () => {
    const pending = authorizeUrl();

    const url = new URL(await pending);

    expect(url.origin + url.pathname).toBe(`${origin}/verifier/oidc/authorize`);
    expect(url.searchParams.get('client_id')).toBe('issuance-portal-sandbox');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid profile email personal_administrative_number');
    expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/issuance-portal/callback`);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(JSON.parse(url.searchParams.get('claims') as string)).toEqual({
      id_token: { acr: { essential: true, value: 'http://eidas.europa.eu/LoA/high' } },
    });
  });

  it('NFR-3: while the holder is at the Verifier the browser keeps only the PKCE verifier, state and nonce', async () => {
    const pending = authorizeUrl();
    await pending;

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
    expect(Object.keys(JSON.parse(sessionStorage.getItem(sessionStorage.key(0) as string) as string)).sort()).toEqual([
      'authNonce',
      'authStateControl',
      'codeVerifier',
    ]);
  });

  it('AC-04: the interceptor gets no token before the login and the one the holder session keeps after it', () => {
    const accessToken = TestBed.inject(ISSUANCE_PORTAL_ACCESS_TOKEN);
    expect(accessToken()).toBeNull();

    jest.spyOn(TestBed.inject(HolderAuthService), 'accessToken').mockReturnValue('real-token');

    expect(accessToken()).toBe('real-token');
  });

  it('AC-04: the service calls carry the Bearer and the configuration and incident calls go without it', async () => {
    jest.spyOn(TestBed.inject(HolderAuthService), 'accessToken').mockReturnValue('real-token');
    const http = TestBed.inject(HttpClient);

    http.get('/issuance-portal/api/v1/journey').subscribe();
    http.get('/issuance-portal/api/v1/config').subscribe();
    http.post('/issuance-portal/api/v1/incidents', {}).subscribe();

    expect(backend.expectOne('/issuance-portal/api/v1/journey').request.headers.get('Authorization')).toBe('Bearer real-token');
    expect(backend.expectOne('/issuance-portal/api/v1/config').request.headers.has('Authorization')).toBe(false);
    expect(backend.expectOne('/issuance-portal/api/v1/incidents').request.headers.has('Authorization')).toBe(false);
  });

  it('AC-13: with a login attestation scope in the configuration the authorize asks for it, so the Verifier offers the wallet', async () => {
    jest
      .spyOn(TestBed.inject(PortalConfigService), 'config')
      .mockReturnValue({ assurance_level: 'substantial', login_attestation_scope: 'doctorid' } as PortalConfig);

    const login = new URL(await authorizeUrl());

    expect(login.searchParams.getAll('scope')).toEqual(['openid profile email personal_administrative_number doctorid']);
    expect(login.searchParams.get('client_id')).toBe('issuance-portal-sandbox');
    expect(login.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('AC-13: the silent login and the new identification ask for the login attestation scope too', async () => {
    jest.spyOn(TestBed.inject(PortalConfigService), 'config').mockReturnValue({ login_attestation_scope: 'doctorid' } as PortalConfig);

    const silent = new URL(await authorizeUrl((auth) => auth.loginSilently()));

    expect(silent.searchParams.get('scope')).toBe('openid profile email personal_administrative_number doctorid');
    expect(silent.searchParams.get('prompt')).toBe('none');
  });

  it('AC-13: without a login attestation scope the authorize asks only for the identity scopes', async () => {
    const login = new URL(await authorizeUrl((auth) => auth.loginAgain()));

    expect(login.searchParams.getAll('scope')).toEqual(['openid profile email personal_administrative_number']);
  });

  it('AC-29: with a tenant of substantial level the authorize asks for it as essential', async () => {
    jest.spyOn(TestBed.inject(PortalConfigService), 'config').mockReturnValue({ assurance_level: 'substantial' } as PortalConfig);

    const url = new URL(await authorizeUrl());

    expect(JSON.parse(url.searchParams.get('claims') as string)).toEqual({
      id_token: { acr: { essential: true, value: 'http://eidas.europa.eu/LoA/substantial' } },
    });
  });

  it('AC-07: the silent login authorize carries prompt=none and keeps the high level of assurance claim', async () => {
    const url = new URL(await authorizeUrl((auth) => auth.loginSilently()));

    expect(url.searchParams.get('prompt')).toBe('none');
    expect(url.searchParams.get('client_id')).toBe('issuance-portal-sandbox');
    expect(JSON.parse(url.searchParams.get('claims') as string).id_token.acr.value).toBe('http://eidas.europa.eu/LoA/high');
  });

  it('AC-07: resumeLogin is the silent login of the holder session', async () => {
    const auth = TestBed.inject(HolderAuthService);
    const silent = jest.spyOn(auth, 'loginSilently').mockImplementation(() => undefined);

    await TestBed.inject(SESSION_ACTIONS).resumeLogin('/requests/r1/data');

    expect(silent).toHaveBeenCalledTimes(1);
    expect(silent).toHaveBeenCalledWith('/requests/r1/data');
  });

  it('AC-08: Empezar and «Volver a intentarlo» go to the Verifier with prompt=login, so its SSO session is not reused', async () => {
    const url = new URL(await authorizeUrl((auth) => auth.loginAgain()));

    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('client_id')).toBe('issuance-portal-sandbox');
    expect(JSON.parse(url.searchParams.get('claims') as string).id_token.acr).toEqual({
      essential: true,
      value: 'http://eidas.europa.eu/LoA/high',
    });
  });

  it('AC-03: restartLogin goes to the Verifier asking for a new identification and discardTokens forgets the token', async () => {
    const auth = TestBed.inject(HolderAuthService);
    const login = jest.spyOn(auth, 'loginAgain').mockImplementation(() => undefined);
    const discard = jest.spyOn(auth, 'discard').mockImplementation(() => undefined);
    const session = TestBed.inject(SESSION_ACTIONS);

    await session.restartLogin();
    session.discardTokens();

    expect(login).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('ES-04: a return with a state that is not the one sent is rejected by the library, with no token and nothing left in the browser', async () => {
    await authorizeUrl();
    const auth = TestBed.inject(HolderAuthService);

    const pending = auth.completeLogin(`${origin}/issuance-portal/callback?code=abc&state=forged-state`);
    await answerDiscovery();
    const completed = await pending;

    expect(completed).toBe('failed');
    expect(auth.accessToken()).toBeNull();
    backend.expectNone(`${origin}/verifier/oidc/token`);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('AC-02: after the trip to the Verifier, with only the flow values left, the return loads the discovery again and exchanges the code', async () => {
    // Lo que queda tras la recarga de la ida al Verifier: la memoria de la librería vacía y el flujo en sessionStorage.
    sessionStorage.setItem('portal-login-flow', JSON.stringify({ authStateControl: 'state-1', codeVerifier: 'verifier-1', authNonce: 'nonce-1' }));
    const auth = TestBed.inject(HolderAuthService);

    const pending = auth.completeLogin(`${origin}/issuance-portal/callback?code=abc&state=state-1`);
    await answerDiscovery();
    let token = backend.match(`${origin}/verifier/oidc/token`);
    for (let attempt = 0; attempt < 20 && token.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve));
      token = backend.match(`${origin}/verifier/oidc/token`);
    }

    expect(token).toHaveLength(1);
    const body = new URLSearchParams(token[0].request.body as string);
    expect(body.get('code')).toBe('abc');
    expect(body.get('code_verifier')).toBe('verifier-1');
    token[0].flush({ error: 'invalid_grant' }, { status: 400, statusText: 'Bad Request' });
    expect(await pending).toBe('failed');
  });
});
