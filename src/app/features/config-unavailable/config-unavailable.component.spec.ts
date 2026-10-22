import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConfigUnavailableComponent } from './config-unavailable.component';
import { PortalConfigService, PortalConfigState } from '../../core/config/portal-config.service';
import { BrandingService } from '../../core/branding/branding.service';
import { TenantLanguageService } from '../../core/branding/tenant-language.service';
import { PortalConfig } from '../../core/api/generated/journey';

expect.extend(toHaveNoViolations);

describe('ConfigUnavailableComponent', () => {
  let fixture: ComponentFixture<ConfigUnavailableComponent>;
  let load: jest.Mock<Promise<PortalConfigState>>;
  let brandingApply: jest.Mock;
  let router: Router;

  const config: PortalConfig = {
    branding: { logo_url: '/assets/tenants/cgcom/logo.png' },
    languages: ['es'],
    texts: {},
    support: {},
    legal_links: {},
  };

  beforeEach(() => {
    load = jest.fn();
    brandingApply = jest.fn();
    TestBed.configureTestingModule({
      imports: [ConfigUnavailableComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: PortalConfigService, useValue: { load } },
        { provide: BrandingService, useValue: { apply: brandingApply } },
        { provide: TenantLanguageService, useValue: { apply: jest.fn() } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ConfigUnavailableComponent);
    fixture.detectChanges();
  });

  function retryButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
  }

  it('ES-01: shows the message with no code, system name or internal detail', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('configUnavailable.title');
    expect(text).not.toMatch(/\b[45]\d{2}\b|config_unavailable|GET \/config|Problem/);
  });

  it('ES-01: once GET /config answers, retrying applies the brand and goes to Inicio', async () => {
    load.mockResolvedValue({ status: 'loaded', config });

    await fixture.componentInstance.onRetry();

    expect(brandingApply).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: '/assets/tenants/cgcom/logo.png' }));
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('ES-01: if it is still unavailable, retrying stays on this screen', async () => {
    load.mockResolvedValue({ status: 'unavailable' });

    await fixture.componentInstance.onRetry();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(retryButton().disabled).toBe(false);
  });

  it('ignores a second retry while one is running', async () => {
    let resolve!: (state: PortalConfigState) => void;
    load.mockReturnValue(new Promise((r) => (resolve = r)));

    const first = fixture.componentInstance.onRetry();
    await fixture.componentInstance.onRetry();
    resolve({ status: 'unavailable' });
    await first;

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('NFR-1: has no accessibility violations', async () => {
    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });
});
