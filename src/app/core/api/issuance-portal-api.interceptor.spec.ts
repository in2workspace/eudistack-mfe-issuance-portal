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

  it.each([
    ['90', 90],
    [' 5 ', 5],
    ['0', 0],
    ['Wed, 21 Oct 2026 07:28:00 GMT', undefined],
    ['soon', undefined],
  ])('EUD-358: a Retry-After of %j becomes retryAfterSeconds %s', (header, seconds) => {
    let error: unknown;
    http.post('/issuance-portal/api/v1/journey/email-verification', {}).subscribe({ error: (e: unknown) => (error = e) });

    controller.expectOne('/issuance-portal/api/v1/journey/email-verification').flush(
      { type: 'resend_too_soon', title: 'Resend too soon', status: 429 },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': header } },
    );

    expect(error).toMatchObject({ type: 'resend_too_soon', status: 429, retryAfterSeconds: seconds });
  });

  it('EUD-358: a Problem without Retry-After (too_many_codes) has no retryAfterSeconds', () => {
    let error: unknown;
    http.post('/issuance-portal/api/v1/journey/email-verification', {}).subscribe({ error: (e: unknown) => (error = e) });

    controller
      .expectOne('/issuance-portal/api/v1/journey/email-verification')
      .flush({ type: 'too_many_codes', title: 'Too many codes', status: 429 }, { status: 429, statusText: 'Too Many Requests' });

    expect((error as ApiProblemError).retryAfterSeconds).toBeUndefined();
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

  it('AC-09 (EUD-284): with an Access Token, sending an incident goes without it and the other calls keep it', () => {
    accessToken = 'token-123';
    http.post('/issuance-portal/api/v1/incidents', {}).subscribe();
    http.get('/issuance-portal/api/v1/journey').subscribe();

    const incident = controller.expectOne('/issuance-portal/api/v1/incidents');
    const journey = controller.expectOne('/issuance-portal/api/v1/journey');
    expect(incident.request.headers.has('Authorization')).toBe(false);
    expect(journey.request.headers.get('Authorization')).toBe('Bearer token-123');
    incident.flush({ response_time: '48 horas' });
    journey.flush({});
  });

  it('AC-06 (EUD-284): an incident rejected by the limit still becomes a typed error', () => {
    let error: unknown;
    http.post('/issuance-portal/api/v1/incidents', {}).subscribe({ error: (e: unknown) => (error = e) });

    controller
      .expectOne('/issuance-portal/api/v1/incidents')
      .flush({ type: 'too_many_requests', title: 'Too many requests', status: 429 }, { status: 429, statusText: 'Too Many Requests' });

    expect(error).toBeInstanceOf(ApiProblemError);
    expect(error).toMatchObject({ type: 'too_many_requests', status: 429 });
  });

  it('only the POST to /incidents is public: another method on that path keeps the Access Token', () => {
    accessToken = 'token-123';
    http.get('/issuance-portal/api/v1/incidents').subscribe();

    const req = controller.expectOne('/issuance-portal/api/v1/incidents');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({});
  });

  it('a failure outside the service API is not translated', () => {
    let error: unknown;
    http.get('assets/i18n/xx.json').subscribe({ error: (e: unknown) => (error = e) });

    controller.expectOne('assets/i18n/xx.json').flush(null, { status: 404, statusText: 'Not Found' });

    expect(error).not.toBeInstanceOf(ApiProblemError);
  });
});
