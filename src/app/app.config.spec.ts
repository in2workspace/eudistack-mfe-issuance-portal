import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, of } from 'rxjs';
import { AppComponent } from './app.component';
import { appConfig, httpInterceptors } from './app.config';
import { ApiProblemError } from './core/api/api-problem.error';
import { PortalConfig } from './core/api/generated/journey';
import { HolderAuthService } from './core/auth/holder-auth.service';
import { TenantBrandingSource } from './core/branding/tenant-branding.source';
import { PortalConfigService, PortalConfigState } from './core/config/portal-config.service';
import { PortalTranslateLoader } from './core/i18n/portal-translate.loader';
import { JourneyInactivityService } from './core/journey/journey-inactivity.service';
import { JourneyNavigator } from './core/journey/journey-navigator';
import { SESSION_ACTIONS } from './core/session/session-actions';

/** Los interceptores encadenados tal como los registra la aplicación. */
describe('HTTP interceptors of the app', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let navigator: { toSessionExpired: jest.Mock; toCurrentStep: jest.Mock };
  let touch: jest.Mock;

  beforeEach(() => {
    navigator = { toSessionExpired: jest.fn().mockResolvedValue(true), toCurrentStep: jest.fn().mockResolvedValue(true) };
    touch = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors(httpInterceptors)),
        provideHttpClientTesting(),
        { provide: HolderAuthService, useValue: { isAccessTokenExpired: () => false, renew: jest.fn(), redirectToVerifier: jest.fn().mockReturnValue(true), confirmSession: jest.fn() } },
        { provide: JourneyNavigator, useValue: navigator },
        { provide: JourneyInactivityService, useValue: { touch } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('run in this order, so the errors interceptor sees the translated ApiProblemError', () => {
    expect(httpInterceptors.map((interceptor) => interceptor.name)).toEqual([
      'journeyActivityInterceptor',
      'journeyErrorsInterceptor',
      'tokenRenewalInterceptor',
      'issuancePortalApiInterceptor',
    ]);
  });

  it('EC-05, ES-01: a 410 counts as activity, reaches the caller as ApiProblemError and shows the session expired case', async () => {
    const url = '/issuance-portal/api/v1/journey/confirmation';
    const call = firstValueFrom(http.post(url, {})).catch((error: unknown) => error);
    backend.expectOne(url).flush({ type: 'journey_closed', title: 'Journey closed', status: 410 }, { status: 410, statusText: 'Gone' });

    const error = await call;

    expect(touch).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect(navigator.toSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('AC-08: a 409 step_not_allowed goes to the step the service gives', async () => {
    const url = '/issuance-portal/api/v1/journey/offers';
    const call = firstValueFrom(http.post(url, {})).catch((error: unknown) => error);
    backend.expectOne(url).flush({ type: 'step_not_allowed', title: 'Step not allowed', status: 409 }, { status: 409, statusText: 'Conflict' });

    await call;

    expect(navigator.toCurrentStep).toHaveBeenCalledTimes(1);
  });
});

describe('Router scrolling of the app', () => {
  const HOME_SCROLL = 1200;
  const HELP_SCROLL = 300;
  const config: PortalConfig = { texts: {}, support: {}, legal_links: {}, wallet_url: 'https://tenant.example/wallet', assurance_level: 'high' };
  /** Network-bound collaborators of the real configuration, replaced so the app boots offline. */
  const offlineProviders = [
    {
      provide: PortalConfigService,
      useValue: { state: signal<PortalConfigState>({ status: 'loaded', config }), config: () => config, load: () => Promise.resolve() },
    },
    { provide: TenantBrandingSource, useValue: { load: () => of({ ok: false, reason: 'absent' }) } },
    { provide: PortalTranslateLoader, useValue: { getTranslation: () => of({}) } },
    { provide: SESSION_ACTIONS, useValue: {} },
  ];
  let app: ApplicationRef;
  let router: Router;
  let scrollTo: jest.SpyInstance;

  /** jsdom has no layout: the page position is whatever `scrollY` says. */
  function setScrollY(y: number): void {
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: y });
  }

  function navigationEnd(): Promise<unknown> {
    return firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd)));
  }

  /** The router scrolls one macrotask after NavigationEnd. */
  async function routerScrolled(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await app.whenStable();
  }

  async function navigate(trigger: () => void): Promise<void> {
    const ended = navigationEnd();
    trigger();
    await ended;
    await routerScrolled();
  }

  function click(selector: string): void {
    (document.querySelector(selector) as HTMLElement).click();
  }

  /** Leaves the holder on Help, scrolled, after coming from the bottom of Home. */
  async function openHelpFromScrolledHome(): Promise<void> {
    setScrollY(HOME_SCROLL);
    await navigate(() => click('[data-testid="help-incident"]'));
    setScrollY(HELP_SCROLL);
    scrollTo.mockClear();
  }

  beforeEach(async () => {
    window.history.replaceState(null, '', '/');
    document.body.innerHTML = '<app-root></app-root>';
    setScrollY(0);
    scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation((_x: number, y: number) => setScrollY(y));
    app = await bootstrapApplication(AppComponent, { providers: [...appConfig.providers, ...offlineProviders] });
    router = app.injector.get(Router);
    if (!router.navigated) {
      await navigationEnd();
    }
    await routerScrolled();
  });

  afterEach(() => {
    app.destroy();
    scrollTo.mockRestore();
  });

  it('AC-01, AC-04: "Report incident" at the bottom of Home opens Help at the top', async () => {
    // Arrange
    setScrollY(HOME_SCROLL);
    scrollTo.mockClear();

    // Act
    await navigate(() => click('[data-testid="help-incident"]'));

    // Assert
    expect(router.url).toBe('/incidents');
    expect(scrollTo.mock.calls).toEqual([[0, 0]]);
  });

  it('AC-03: browser back from Help restores the position Home was left at', async () => {
    // Arrange
    await openHelpFromScrolledHome();

    // Act
    await navigate(() => window.history.back());

    // Assert
    expect(router.url).toBe('/');
    expect(scrollTo.mock.calls).toEqual([[0, HOME_SCROLL]]);
  });

  it.each([
    ['header back arrow', 'app-portal-header button'],
    ['"Cancel" button', 'app-incidents form button[type="button"]'],
  ])('EC-01: the %s on Help opens Home at the top', async (_, selector) => {
    // Arrange
    await openHelpFromScrolledHome();

    // Act
    await navigate(() => click(selector));

    // Assert
    expect(router.url).toBe('/');
    expect(scrollTo.mock.calls).toEqual([[0, 0]]);
  });
});
