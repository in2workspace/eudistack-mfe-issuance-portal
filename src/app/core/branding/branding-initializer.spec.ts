import { TestBed } from '@angular/core/testing';
import { initializeBranding } from './branding.initializer';
import { BrandingService } from './branding.service';
import { TenantLanguageService } from './tenant-language.service';
import { DEFAULT_EUDISTACK_BRANDING } from './tenant-branding.model';
import { PortalConfigService, PortalConfigState } from '../config/portal-config.service';
import { PortalConfig } from '../api/generated/journey';

describe('initializeBranding', () => {
  let brandingApplySpy: jest.Mock;
  let languageApplySpy: jest.Mock;

  const config: PortalConfig = {
    branding: { logo_url: '/assets/tenants/cgcom/logo.png', colors: { primary: '#123456' } },
    languages: ['es'],
    texts: {},
    support: {},
    legal_links: {},
  };

  function configure(load: () => Promise<PortalConfigState>): void {
    brandingApplySpy = jest.fn();
    languageApplySpy = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: PortalConfigService, useValue: { load: jest.fn(load) } },
        { provide: BrandingService, useValue: { apply: brandingApplySpy } },
        { provide: TenantLanguageService, useValue: { apply: languageApplySpy } },
      ],
    });
  }

  it('AC-01: applies the brand of GET /config before the component tree bootstraps', async () => {
    configure(async () => ({ status: 'loaded', config }));

    await TestBed.runInInjectionContext(() => initializeBranding());

    const expected = expect.objectContaining({ logoUrl: '/assets/tenants/cgcom/logo.png' });
    expect(brandingApplySpy).toHaveBeenCalledWith(expected);
    expect(languageApplySpy).toHaveBeenCalledWith(expected);
  });

  it('ES-01: without configuration applies the neutral brand and never blocks bootstrap', async () => {
    configure(async () => ({ status: 'unavailable' }));

    await expect(TestBed.runInInjectionContext(() => initializeBranding())).resolves.toBeUndefined();

    expect(brandingApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
    expect(languageApplySpy).toHaveBeenCalledWith(DEFAULT_EUDISTACK_BRANDING);
  });

  it('never rejects, even on an unexpected failure', async () => {
    configure(async () => {
      throw new Error('boom');
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(TestBed.runInInjectionContext(() => initializeBranding())).resolves.toBeUndefined();
  });
});
