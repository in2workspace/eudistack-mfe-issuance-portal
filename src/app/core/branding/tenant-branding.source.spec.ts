import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TenantBrandingSource } from './tenant-branding.source';
import { TenantBrandingResult } from './tenant-branding.model';

describe('TenantBrandingSource', () => {
  let source: TenantBrandingSource;
  let httpMock: HttpTestingController;

  const urlFor = (tenant: string): string => `/assets/tenants/${tenant}/theme.json`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    source = TestBed.inject(TenantBrandingSource);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the descriptor from the same-origin shared assets path (no external host config, SAD §8.8)', fakeAsync(() => {
    let emitted: TenantBrandingResult | undefined;
    const descriptor = { branding: { name: 'CGCOM' } };

    source.load('cgcom').subscribe((result) => (emitted = result));
    httpMock.expectOne(urlFor('cgcom')).flush(descriptor);

    expect(emitted).toEqual({ ok: true, descriptor });
  }));

  it('rewrites the legacy /assets/tenant/* logo and favicon paths to the tenant-specific folder', fakeAsync(() => {
    let emitted: TenantBrandingResult | undefined;
    const descriptor = {
      branding: { name: 'CGCOM', logoUrl: '/assets/tenant/logo.png', faviconUrl: 'assets/tenant/favicon.png' },
    };

    source.load('cgcom').subscribe((result) => (emitted = result));
    httpMock.expectOne(urlFor('cgcom')).flush(descriptor);

    expect(emitted).toEqual({
      ok: true,
      descriptor: {
        branding: {
          name: 'CGCOM',
          logoUrl: '/assets/tenants/cgcom/logo.png',
          faviconUrl: '/assets/tenants/cgcom/favicon.png',
        },
      },
    });
  }));

  it('maps a 404 to a fail-safe absent result and logs a warning without exposing detail (ES-02)', fakeAsync(() => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let emitted: TenantBrandingResult | undefined;

    source.load('cgcom').subscribe((result) => (emitted = result));
    httpMock.expectOne(urlFor('cgcom')).flush(null, { status: 404, statusText: 'Not Found' });

    expect(emitted).toEqual({ ok: false, reason: 'absent' });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  }));

  it('maps a network/5xx failure to a fail-safe error result (ES-04)', fakeAsync(() => {
    let emitted: TenantBrandingResult | undefined;

    source.load('cgcom').subscribe((result) => (emitted = result));
    httpMock.expectOne(urlFor('cgcom')).flush(null, { status: 500, statusText: 'Server Error' });

    expect(emitted).toEqual({ ok: false, reason: 'error' });
  }));

  it('maps a timeout to a fail-safe result without waiting indefinitely (ES-05)', fakeAsync(() => {
    let emitted: TenantBrandingResult | undefined;

    source.load('cgcom').subscribe((result) => (emitted = result));
    httpMock.expectOne(urlFor('cgcom'));
    tick(3_100);

    expect(emitted).toEqual({ ok: false, reason: 'timeout' });
    // `timeout()` unsubscribes the underlying request — HttpTestingController
    // marks it cancelled, so `verify()` does not expect it to be flushed.
  }));
});
