import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BehaviorSubject } from 'rxjs';
import { ErrorComponent } from './error.component';
import { ERROR_REASONS, ErrorReason } from './error-reason';
import { PortalConfigService } from '../../core/config/portal-config.service';
import { SESSION_ACTIONS, SessionActions } from '../../core/session/session-actions';
import { PortalConfig, PortalConfigSupport } from '../../core/api/generated/journey';

expect.extend(toHaveNoViolations);

describe('ErrorComponent', () => {
  let fixture: ComponentFixture<ErrorComponent>;
  let router: Router;
  let session: jest.Mocked<SessionActions>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const config = signal<PortalConfig | null>(null);

  function configWith(support: PortalConfigSupport): PortalConfig {
    return { texts: {}, support, legal_links: {}, wallet_url: 'https://cgcom.example/wallet' };
  }

  function show(reason: string): HTMLElement {
    params.next(convertToParamMap({ reason }));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function clickAction(): Promise<void> {
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    await fixture.whenStable();
  }

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({}));
    session = { restartLogin: jest.fn().mockResolvedValue(undefined), discardTokens: jest.fn() };
    config.set(configWith({ email: 'soporte@cgcom.example', phone: '900 000 000', schedule: 'L-V 9-18' }));
    TestBed.configureTestingModule({
      imports: [ErrorComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: SESSION_ACTIONS, useValue: session },
        { provide: PortalConfigService, useValue: { config } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ErrorComponent);
  });

  it.each(ERROR_REASONS)('AC-03: %s shows its title, description and action', (reason) => {
    const text = show(reason).textContent ?? '';

    expect(text).toContain(`error.${reason}.title`);
    expect(text).toContain(`error.${reason}.description`);
    expect(text).toContain(`error.${reason}.action`);
  });

  it.each<[ErrorReason, unknown[]]>([
    ['not-entitled', ['/']],
    ['source-unavailable', ['/', 'entitlement']],
    ['issuance-failed', ['/', 'offer']],
    ['onboarding-unavailable', ['/', 'offer']],
    ['session-expired', ['/']],
  ])('AC-03: the action of %s goes to %j', async (reason, target) => {
    show(reason);

    await clickAction();

    expect(router.navigate).toHaveBeenCalledWith(target);
    expect(session.discardTokens).not.toHaveBeenCalled();
  });

  it('AC-04: identification-failed takes the holder back to the Verifier login', async () => {
    show('identification-failed');

    await clickAction();

    expect(session.restartLogin).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('AC-07: offer-not-renewable discards the tokens and goes to Inicio', async () => {
    show('offer-not-renewable');

    await clickAction();

    expect(session.discardTokens).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('AC-10: not-entitled shows the tenant support contact', () => {
    const support = show('not-entitled').querySelector('[data-testid="error-support"]');

    expect(support?.textContent).toContain('error.support.email');
    expect(support?.textContent).toContain('error.support.phone');
    expect(support?.textContent).toContain('error.support.schedule');
  });

  it('AC-10: not-entitled leaves out the support lines the tenant does not have', () => {
    config.set(configWith({ email: 'soporte@cgcom.example' }));

    const support = show('not-entitled').querySelector('[data-testid="error-support"]');

    expect(support?.querySelectorAll('li')).toHaveLength(1);
  });

  it('AC-10: no support box when the tenant has no support contact', () => {
    config.set(configWith({}));

    expect(show('not-entitled').querySelector('[data-testid="error-support"]')).toBeNull();
  });

  it.each(ERROR_REASONS.filter((reason) => reason !== 'not-entitled'))('AC-10: %s does not show the support box', (reason) => {
    expect(show(reason).querySelector('[data-testid="error-support"]')).toBeNull();
  });

  it.each(ERROR_REASONS)('AC-10: %s shows no code, status or system name', (reason) => {
    const text = show(reason).textContent ?? '';

    expect(text).not.toMatch(/\b[45]\d{2}\b|journey_closed|step_not_allowed|offer_not_renewable|onboarding_unavailable|Verifier|Wallet Unit Service/);
  });

  it('EC-03: an unknown case renders nothing', () => {
    expect(show('anything').querySelector('main')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    expect(await axe(show('not-entitled'))).toHaveNoViolations();
  });
});
