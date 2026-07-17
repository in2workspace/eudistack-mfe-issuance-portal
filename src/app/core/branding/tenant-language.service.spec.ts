import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { TenantLanguageService } from './tenant-language.service';
import { TenantBranding } from './tenant-branding.model';

describe('TenantLanguageService', () => {
  let service: TenantLanguageService;
  let translateSpy: { use: jest.Mock };

  function brandingWith(defaultLanguage: string, supportedLanguages: string[]): TenantBranding {
    return {
      tokens: {},
      logoUrl: '',
      faviconUrl: '',
      appName: 'Test',
      defaultLanguage,
      supportedLanguages,
    };
  }

  beforeEach(() => {
    translateSpy = { use: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translateSpy }],
    });
    service = TestBed.inject(TenantLanguageService);
  });

  it('uses the tenant configured language when it is in its own supported allow-list (AC-02)', () => {
    service.apply(brandingWith('en', ['en', 'es']));
    expect(translateSpy.use).toHaveBeenCalledWith('en');
  });

  it('falls back to the base app language when the configured language is not supported by the tenant itself (EC-03)', () => {
    service.apply(brandingWith('fr', ['en', 'es']));
    expect(translateSpy.use).toHaveBeenCalledWith('es');
  });

  it('applies a non-base tenant language when it is supported, so its full catalog is used (EC-04)', () => {
    service.apply(brandingWith('en', ['en']));
    expect(translateSpy.use).toHaveBeenCalledWith('en');
  });
});
