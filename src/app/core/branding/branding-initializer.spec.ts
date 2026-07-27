import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { initializeBranding } from './branding.initializer';
import { TenantBrandingSource } from './tenant-branding.source';
import { BrandingService } from './branding.service';
import { TenantLanguageService } from './tenant-language.service';
import { DEFAULT_EUDISTACK_BRANDING, TenantBrandingResult } from './tenant-branding.model';

describe('initializeBranding', () => {
  let sourceSpy: { load: jest.Mock };
  let brandingApplySpy: jest.Mock;
  let languageApplySpy: jest.Mock;
  const originalLocation = window.location;

  function setHostname(hostname: string): void {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, hostname },
    });
  }

  function configure(load$: Observable<TenantBrandingResult>): void {
    sourceSpy = { load: jest.fn().mockReturnValue(load$) };
    brandingApplySpy = jest.fn();
    languageApplySpy = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: TenantBrandingSource, useValue: sourceSpy },
        { provide: BrandingService, useValue: { apply: brandingApplySpy } },
        { provide: TenantLanguageService, useValue: { apply: languageApplySpy } },
      ],
    });
  }

  afterEach(() => {
    Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation });
  });

  it('orchestrates identity → load → resolve → apply before the component tree bootstraps (AC-06)', async () => {
    setHostname('cgcom.eudistack.net');
    const result: TenantBrandingResult = { ok: true, descriptor: { branding: { name: 'CGCOM' } } };
    configure(of(result));

    await TestBed.runInInjectionContext(() => initializeBranding());

    expect(sourceSpy.load).toHaveBeenCalledWith('cgcom');
    expect(brandingApplySpy).toHaveBeenCalledWith(expect.objectContaining({ appName: 'CGCOM' }));
    expect(languageApplySpy).toHaveBeenCalledWith(expect.objectContaining({ appName: 'CGCOM' }));
  });

  it('resolves to the neutral default and never blocks bootstrap on a network/5xx failure (ES-04)', async () => {
    setHostname('cgcom.eudistack.net');
    configure(throwError(() => new Error('network error')));

    await expect(TestBed.runInInjectionContext(() => initializeBranding())).resolves.toBeUndefined();

    expect(brandingApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
    expect(languageApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
  });

  it('resolves to the neutral default and never blocks bootstrap on a timeout (ES-05)', async () => {
    setHostname('cgcom.eudistack.net');
    configure(throwError(() => new Error('Timeout has occurred')));

    await expect(TestBed.runInInjectionContext(() => initializeBranding())).resolves.toBeUndefined();

    expect(brandingApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
  });

  it('never calls the branding source when the tenant identity is not resolvable (ES-03)', async () => {
    setHostname('localhost');
    configure(of({ ok: true, descriptor: {} }));

    await TestBed.runInInjectionContext(() => initializeBranding());

    expect(sourceSpy.load).not.toHaveBeenCalled();
    expect(brandingApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
  });
});
