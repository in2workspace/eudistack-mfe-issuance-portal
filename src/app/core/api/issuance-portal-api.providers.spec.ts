import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigurationApi } from './generated/journey';
import { EntitlementApi } from './generated/authentic-source';
import { provideIssuancePortalApi } from './issuance-portal-api.providers';

describe('provideIssuancePortalApi', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideIssuancePortalApi()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('AC-07: the journey client calls the service on the same host', () => {
    TestBed.inject(ConfigurationApi).getPortalConfig().subscribe();

    http.expectOne('/issuance-portal/api/v1/config').flush({});
  });

  it('AC-07: the authentic source client calls the service on the same host', () => {
    TestBed.inject(EntitlementApi).verifyEntitlement().subscribe();

    http.expectOne((req) => req.url.startsWith('/issuance-portal/api/v1/')).flush({});
  });
});
