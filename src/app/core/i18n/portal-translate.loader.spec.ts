import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortalTranslateLoader } from './portal-translate.loader';
import { PortalConfigService } from '../config/portal-config.service';

describe('PortalTranslateLoader', () => {
  let loader: PortalTranslateLoader;
  let http: HttpTestingController;
  const texts = signal<Record<string, unknown>>({});

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PortalConfigService, useValue: { config: () => ({ texts: texts() }) } },
      ],
    });
    loader = TestBed.inject(PortalTranslateLoader);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('AC-05: a tenant text replaces the product text for the active language', () => {
    texts.set({ es: { 'issuanceInfo.title': 'Obtén tu DoctorID' } });
    let result: Record<string, unknown> = {};
    loader.getTranslation('es').subscribe((t) => (result = t as Record<string, unknown>));

    http.expectOne('assets/i18n/es.json').flush({ 'issuanceInfo.title': 'Solicita tu atestación', 'issuanceInfo.cta': 'Empezar' });

    expect(result).toEqual({ 'issuanceInfo.title': 'Obtén tu DoctorID', 'issuanceInfo.cta': 'Empezar' });
  });

  it('merges nested tenant texts without dropping the other product texts', () => {
    texts.set({ es: { portal: { app_name: 'Portal de DoctorID' } } });
    let result: Record<string, unknown> = {};
    loader.getTranslation('es').subscribe((t) => (result = t as Record<string, unknown>));

    http.expectOne('assets/i18n/es.json').flush({ portal: { app_name: 'Portal de emisión', title: 'Portal' } });

    expect(result).toEqual({ portal: { app_name: 'Portal de DoctorID', title: 'Portal' } });
  });

  it('uses only the product texts when the tenant has none for that language', () => {
    texts.set({ es: { 'issuanceInfo.title': 'Obtén tu DoctorID' } });
    let result: Record<string, unknown> = {};
    loader.getTranslation('en').subscribe((t) => (result = t as Record<string, unknown>));

    http.expectOne('assets/i18n/en.json').flush({ 'issuanceInfo.title': 'Request your attestation' });

    expect(result).toEqual({ 'issuanceInfo.title': 'Request your attestation' });
  });

  it('keeps the tenant texts when the product has no file for that language', () => {
    texts.set({ ca: { 'issuanceInfo.title': 'Obté el teu DoctorID' } });
    let result: Record<string, unknown> = {};
    loader.getTranslation('ca').subscribe((t) => (result = t as Record<string, unknown>));

    http.expectOne('assets/i18n/ca.json').flush(null, { status: 404, statusText: 'Not Found' });

    expect(result).toEqual({ 'issuanceInfo.title': 'Obté el teu DoctorID' });
  });
});
