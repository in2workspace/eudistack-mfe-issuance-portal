import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConfigUnavailableComponent } from './config-unavailable.component';
import { PortalConfigService, PortalConfigState } from '../../core/config/portal-config.service';
import { TenantLanguageService } from '../../core/branding/tenant-language.service';
import { PortalConfig } from '../../core/api/generated/journey';

expect.extend(toHaveNoViolations);

describe('ConfigUnavailableComponent', () => {
  let fixture: ComponentFixture<ConfigUnavailableComponent>;
  let load: jest.Mock<Promise<PortalConfigState>>;
  let reloadTexts: jest.Mock;
  let router: Router;

  const config: PortalConfig = { texts: {}, support: {}, legal_links: {}, wallet_url: 'https://cgcom.example/wallet' };

  beforeEach(() => {
    load = jest.fn();
    reloadTexts = jest.fn();
    TestBed.configureTestingModule({
      imports: [ConfigUnavailableComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: PortalConfigService, useValue: { load } },
        { provide: TenantLanguageService, useValue: { reloadTexts } },
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

  it('AC-04: shows the message with no code, system name or internal detail', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('configUnavailable.title');
    expect(text).not.toMatch(/\b[45]\d{2}\b|config_unavailable|GET \/config|Problem/);
  });

  it('AC-04: once GET /config answers, retrying reloads the texts with the tenant ones and goes to Inicio', async () => {
    load.mockResolvedValue({ status: 'loaded', config });

    await fixture.componentInstance.onRetry();

    expect(reloadTexts).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('AC-04: if it is still unavailable, retrying stays on this screen', async () => {
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
