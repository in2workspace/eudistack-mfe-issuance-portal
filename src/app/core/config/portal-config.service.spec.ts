import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideIssuancePortalApi } from '../api/issuance-portal-api.providers';
import { PortalConfigService } from './portal-config.service';

describe('PortalConfigService', () => {
  let service: PortalConfigService;
  let http: HttpTestingController;

  const config = {
    texts: {},
    support: { email: 'soporte@example.org' },
    legal_links: {},
    wallet_url: 'https://cgcom.example/wallet',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideIssuancePortalApi()],
    });
    service = TestBed.inject(PortalConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts loading and publishes the configuration once GET /config answers', async () => {
    expect(service.state().status).toBe('loading');

    const loaded = service.load();
    http.expectOne('/issuance-portal/api/v1/config').flush(config);

    expect(await loaded).toEqual({ status: 'loaded', config });
    expect(service.config()).toEqual(config);
  });

  it('AC-04: config_unavailable (503) leaves the configuration unavailable', async () => {
    const loaded = service.load();
    http
      .expectOne('/issuance-portal/api/v1/config')
      .flush({ type: 'config_unavailable', title: 'Config unavailable', status: 503 }, { status: 503, statusText: 'Service Unavailable' });

    expect(await loaded).toEqual({ status: 'unavailable' });
    expect(service.config()).toBeNull();
  });

  it('ES-01: no answer in 3 seconds leaves the configuration unavailable', async () => {
    jest.useFakeTimers();
    try {
      const loaded = service.load();
      const req = http.expectOne('/issuance-portal/api/v1/config');

      jest.advanceTimersByTime(PortalConfigService.REQUEST_TIMEOUT_MS);

      expect(await loaded).toEqual({ status: 'unavailable' });
      expect(req.cancelled).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ES-02: a configuration without its required fields is unavailable', async () => {
    const loaded = service.load();
    http.expectOne('/issuance-portal/api/v1/config').flush({ ...config, wallet_url: undefined });

    expect(await loaded).toEqual({ status: 'unavailable' });
  });

  it('AC-04: a retry after a failure can load the configuration', async () => {
    const first = service.load();
    http.expectOne('/issuance-portal/api/v1/config').error(new ProgressEvent('error'));
    await first;

    const second = service.load();
    http.expectOne('/issuance-portal/api/v1/config').flush(config);

    expect((await second).status).toBe('loaded');
  });
});
