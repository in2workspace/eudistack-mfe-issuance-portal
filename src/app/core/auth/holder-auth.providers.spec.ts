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

  /** La URL de `authorize` a la que la librería llevaría al titular. */
  async function authorizeUrl(): Promise<string> {
    const target = new Promise<string>((resolve) => {
      TestBed.inject(OidcSecurityService).authorize(undefined, { urlHandler: resolve });
    });
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
    http.post('/issuance-portal/api/v1/incidents', {}).subscribe();

    expect(backend.expectOne('/issuance-portal/api/v1/journey').request.headers.get('Authorization')).toBe('Bearer real-token');
    expect(backend.expectOne('/issuance-portal/api/v1/incidents').request.headers.has('Authorization')).toBe(false);
  });

  it('AC-07: the silent login authorize carries prompt=none and keeps the high level of assurance claim', async () => {
    const target = new Promise<string>((resolve) => {
      TestBed.inject(OidcSecurityService).authorize(undefined, { customParams: { prompt: 'none' }, urlHandler: resolve });
    });
    await answerDiscovery();

    const url = new URL(await target);

    expect(url.searchParams.get('prompt')).toBe('none');
    expect(url.searchParams.get('client_id')).toBe('issuance-portal-sandbox');
    expect(JSON.parse(url.searchParams.get('claims') as string).id_token.acr.value).toBe('http://eidas.europa.eu/LoA/high');
  });

  it('AC-07: resumeLogin is the silent login of the holder session', async () => {
    const auth = TestBed.inject(HolderAuthService);
    const silent = jest.spyOn(auth, 'loginSilently').mockImplementation(() => undefined);

    await TestBed.inject(SESSION_ACTIONS).resumeLogin();

    expect(silent).toHaveBeenCalledTimes(1);
  });

  it('AC-03: restartLogin goes to the Verifier and discardTokens forgets the token', async () => {
    const auth = TestBed.inject(HolderAuthService);
    const login = jest.spyOn(auth, 'login').mockImplementation(() => undefined);
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

    const completed = await auth.completeLogin(`${origin}/issuance-portal/callback?code=abc&state=forged-state`);

    expect(completed).toBe('failed');
    expect(auth.accessToken()).toBeNull();
    backend.expectNone(`${origin}/verifier/oidc/token`);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
