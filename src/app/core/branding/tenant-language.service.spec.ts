import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { TenantLanguageService } from './tenant-language.service';
import { DEFAULT_EUDISTACK_BRANDING, TenantBranding } from './tenant-branding.model';

describe('TenantLanguageService', () => {
  let service: TenantLanguageService;
  let translateSpy: { use: jest.Mock; addLangs: jest.Mock; setDefaultLang: jest.Mock };

  function brandingWith(supportedLanguages: string[]): TenantBranding {
    return { ...DEFAULT_EUDISTACK_BRANDING, defaultLanguage: supportedLanguages[0], supportedLanguages };
  }

  beforeEach(() => {
    translateSpy = { use: jest.fn(), addLangs: jest.fn(), setDefaultLang: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy }],
    });
    service = TestBed.inject(TenantLanguageService);
  });

  it('AC-02: uses the browser language when the tenant offers it', () => {
    service.apply(brandingWith(['es', 'en']), ['en']);

    expect(translateSpy.use).toHaveBeenLastCalledWith('en');
    expect(service.current()).toBe('en');
    expect(service.supported()).toEqual(['es', 'en']);
  });

  it('AC-03: uses the first language of the tenant when it does not offer the browser one', () => {
    service.apply(brandingWith(['es', 'en']), ['fr-FR', 'fr']);

    expect(translateSpy.use).toHaveBeenLastCalledWith('es');
  });

  it('falls back to the first language of the tenant for missing keys', () => {
    service.apply(brandingWith(['es', 'en']), ['en']);

    expect(translateSpy.setDefaultLang).toHaveBeenCalledWith('es');
  });

  it('EC-02: compares languages without their region', () => {
    service.apply(brandingWith(['es', 'en']), ['en-GB']);

    expect(service.current()).toBe('en');
  });

  it('takes the browser languages in order of preference', () => {
    service.apply(brandingWith(['es', 'en']), ['fr', 'en-US', 'es']);

    expect(service.current()).toBe('en');
  });

  it('AC-02: the holder can switch to another language of the tenant', () => {
    service.apply(brandingWith(['es', 'en']), ['en']);

    service.use('es');

    expect(translateSpy.use).toHaveBeenLastCalledWith('es');
    expect(service.current()).toBe('es');
  });

  it('ignores a language the tenant does not offer', () => {
    service.apply(brandingWith(['es', 'en']), ['en']);
    translateSpy.use.mockClear();

    service.use('fr');

    expect(translateSpy.use).not.toHaveBeenCalled();
    expect(service.current()).toBe('en');
  });
});
