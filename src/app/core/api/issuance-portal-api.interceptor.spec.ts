import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ISSUANCE_PORTAL_ACCESS_TOKEN, issuancePortalApiInterceptor } from './issuance-portal-api.interceptor';
import { ApiProblemError, NETWORK_ERROR, UNEXPECTED_ERROR } from './api-problem.error';

describe('issuancePortalApiInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let accessToken: string | null;

  beforeEach(() => {
    accessToken = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([issuancePortalApiInterceptor])),
        provideHttpClientTesting(),
        { provide: ISSUANCE_PORTAL_ACCESS_TOKEN, useValue: () => accessToken },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('AC-10: a call to the service carries neither the cookie nor X-Requested-With', () => {
    http.post('/issuance-portal/api/v1/journey', null).subscribe();

    const req = controller.expectOne('/issuance-portal/api/v1/journey');
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('X-Requested-With')).toBe(false);
    req.flush({});
  });

  it('AC-10: without an Access Token there is no Authorization header', () => {
    http.get('/issuance-portal/api/v1/config').subscribe();

    const req = controller.expectOne('/issuance-portal/api/v1/config');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('AC-10: with an Access Token, a call to the service carries it as Bearer', () => {
    accessToken = 'token-123';
    http.get('/issuance-portal/api/v1/journey').subscribe();

    const req = controller.expectOne('/issuance-portal/api/v1/journey');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({});
  });

  it.each(['assets/i18n/es.json', '/assets/tenants/cgcom/theme.json'])(
    'AC-10: a request to %s never carries the Access Token',
    (url) => {
      accessToken = 'token-123';
      http.get(url).subscribe();

      const req = controller.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    },
  );

  it('AC-10: a Problem response becomes a typed error with its type, status and title', () => {
    let error: unknown;
    http.get('/issuance-portal/api/v1/journey').subscribe({ error: (e: unknown) => (error = e) });

    controller
      .expectOne('/issuance-portal/api/v1/journey')
      .flush({ type: 'journey_closed', title: 'Journey closed', status: 410 }, { status: 410, statusText: 'Gone' });

    expect(error).toBeInstanceOf(ApiProblemError);
    expect(error).toMatchObject({ type: 'journey_closed', status: 410, title: 'Journey closed' });
  });

  it('ES-04: an error without a Problem body gets the generic type and the response status', () => {
    let error: unknown;
    http.get('/issuance-portal/api/v1/config').subscribe({ error: (e: unknown) => (error = e) });

    controller.expectOne('/issuance-portal/api/v1/config').flush('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' });

    expect(error).toMatchObject({ type: UNEXPECTED_ERROR, status: 502 });
  });

  it('ES-04: a network failure gets the network type and status 0', () => {
    let error: unknown;
    http.get('/issuance-portal/api/v1/config').subscribe({ error: (e: unknown) => (error = e) });

    controller.expectOne('/issuance-portal/api/v1/config').error(new ProgressEvent('error'));

    expect(error).toMatchObject({ type: NETWORK_ERROR, status: 0 });
  });

  it('a failure outside the service API is not translated', () => {
    let error: unknown;
    http.get('assets/i18n/xx.json').subscribe({ error: (e: unknown) => (error = e) });

    controller.expectOne('assets/i18n/xx.json').flush(null, { status: 404, statusText: 'Not Found' });

    expect(error).not.toBeInstanceOf(ApiProblemError);
  });
});
