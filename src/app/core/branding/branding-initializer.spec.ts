import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { initializeBranding } from './branding.initializer';
import { TenantBrandingSource } from './tenant-branding.source';
import { BrandingService } from './branding.service';
import { TenantLanguageService } from './tenant-language.service';
import { DEFAULT_EUDISTACK_BRANDING, TenantBrandingResult } from './tenant-branding.model';
import { PortalConfigService, PortalConfigState } from '../config/portal-config.service';

describe('initializeBranding', () => {
  let sourceSpy: { load: jest.Mock };
  let configLoad: jest.Mock;
  let brandingApplySpy: jest.Mock;
  let languageApplySpy: jest.Mock;
  const originalLocation = window.location;

  const cgcomTheme: TenantBrandingResult = {
    ok: true,
    descriptor: {
      branding: { logoUrl: '/assets/tenants/cgcom/logo.png', primaryColor: '#123456' },
      i18n: { defaultLang: 'es', available: ['es', 'en'] },
    },
  };

  function setHostname(hostname: string): void {
    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: { ...originalLocation, hostname } });
  }

  function configure(load$: Observable<TenantBrandingResult>, config: PortalConfigState): void {
    sourceSpy = { load: jest.fn().mockReturnValue(load$) };
    configLoad = jest.fn().mockResolvedValue(config);
    brandingApplySpy = jest.fn();
    languageApplySpy = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: TenantBrandingSource, useValue: sourceSpy },
        { provide: PortalConfigService, useValue: { load: configLoad } },
        { provide: BrandingService, useValue: { apply: brandingApplySpy } },
        { provide: TenantLanguageService, useValue: { apply: languageApplySpy } },
      ],
    });
  }

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation });
  });

  it('AC-01: loads the theme.json of the tenant of the host and GET /config, then applies brand and language', async () => {
    setHostname('cgcom.eudistack.net');
    configure(of(cgcomTheme), { status: 'unavailable' });

    await TestBed.runInInjectionContext(() => initializeBranding());

    expect(sourceSpy.load).toHaveBeenCalledWith('cgcom');
    expect(configLoad).toHaveBeenCalledTimes(1);
    const expected = expect.objectContaining({ logoUrl: '/assets/tenants/cgcom/logo.png', supportedLanguages: ['es', 'en'] });
    expect(brandingApplySpy).toHaveBeenCalledWith(expected);
    expect(languageApplySpy).toHaveBeenCalledWith(expected);
  });

  it('AC-04: the tenant brand is applied even when GET /config is unavailable', async () => {
    setHostname('cgcom.eudistack.net');
    configure(of(cgcomTheme), { status: 'unavailable' });

    await TestBed.runInInjectionContext(() => initializeBranding());

    expect(brandingApplySpy).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: '/assets/tenants/cgcom/logo.png' }));
  });

  it('ES-03: when the theme does not load, applies the EUDIStack theme and never blocks bootstrap', async () => {
    setHostname('cgcom.eudistack.net');
    configure(throwError(() => new Error('network error')), { status: 'unavailable' });

    await expect(TestBed.runInInjectionContext(() => initializeBranding())).resolves.toBeUndefined();

    expect(brandingApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
    expect(languageApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
  });

  it('EC-05: a tenant without theme.json gets the EUDIStack theme', async () => {
    setHostname('nuevo.eudistack.net');
    configure(of<TenantBrandingResult>({ ok: false, reason: 'absent' }), { status: 'unavailable' });

    await TestBed.runInInjectionContext(() => initializeBranding());

    expect(brandingApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
  });

  it('never asks for a theme when the tenant cannot be resolved from the host', async () => {
    setHostname('localhost');
    configure(of(cgcomTheme), { status: 'unavailable' });

    await TestBed.runInInjectionContext(() => initializeBranding());

    expect(sourceSpy.load).not.toHaveBeenCalled();
    expect(brandingApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
  });
});
