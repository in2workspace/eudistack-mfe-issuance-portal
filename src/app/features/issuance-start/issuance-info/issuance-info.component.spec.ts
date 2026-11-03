import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PortalConfig } from '../../../core/api/generated/journey';
import { PortalConfigService } from '../../../core/config/portal-config.service';
import { SESSION_ACTIONS, SessionActions } from '../../../core/session/session-actions';
import { IssuanceInfoComponent } from './issuance-info.component';

const FULL_CONFIG: PortalConfig = {
  wallet_url: 'https://wallet.example',
  texts: {},
  support: { email: 'soporte@tenant.example', phone: '911 000 000', schedule: 'L-V 8:00-15:00', response_time: '24 horas' },
  legal_links: {
    legal_notice: 'https://tenant.example/aviso',
    privacy: 'https://tenant.example/privacidad',
    terms: '/condiciones',
    accessibility: 'https://tenant.example/accesibilidad',
  },
};

/** Selects the single "arranque" CTA among the page's buttons. */
function queryStartCta(compiled: HTMLElement): HTMLButtonElement | null {
  return compiled.querySelector('button[aria-label="issuanceInfo.cta.ariaLabel"]');
}

describe('IssuanceInfoComponent', () => {
  let fixture: ComponentFixture<IssuanceInfoComponent>;
  let session: jest.Mocked<SessionActions>;
  const config = signal<PortalConfig | null>(FULL_CONFIG);

  function render(value: PortalConfig | null): HTMLElement {
    config.set(value);
    fixture = TestBed.createComponent(IssuanceInfoComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    session = { restartLogin: jest.fn().mockResolvedValue(undefined), discardTokens: jest.fn() };
    TestBed.configureTestingModule({
      imports: [IssuanceInfoComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SESSION_ACTIONS, useValue: session },
        { provide: PortalConfigService, useValue: { config } },
      ],
    });
  });

  it('renders info + a single visible start CTA with clear action text', () => {
    const compiled = render(FULL_CONFIG);
    const startCtas = compiled.querySelectorAll('button[aria-label="issuanceInfo.cta.ariaLabel"]');

    expect(compiled.querySelectorAll('h1')).toHaveLength(1);
    expect(startCtas).toHaveLength(1);
    expect(startCtas[0].textContent?.trim().length).toBeGreaterThan(0);
  });

  it('AC-02: "Empezar" asks the session to go to the Verifier, without navigating or storing anything', () => {
    const compiled = render(FULL_CONFIG);
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate');
    const navigateByUrl = jest.spyOn(router, 'navigateByUrl');

    queryStartCta(compiled)?.click();

    expect(session.restartLogin).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(sessionStorage).toHaveLength(0);
    expect(localStorage).toHaveLength(0);
  });

  it.each(['hero-help', 'help-incident'])('AC-03: %s goes to Ayuda', (testId) => {
    const compiled = render(FULL_CONFIG);
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    compiled.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();

    expect(navigate).toHaveBeenCalledWith(['/incidents']);
  });

  it('AC-01: the legal links lead to the addresses of the tenant configuration, in the wireframe order', () => {
    const compiled = render(FULL_CONFIG);
    const links = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('[data-testid="footer-legal"] a'));

    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://tenant.example/aviso',
      'https://tenant.example/privacidad',
      '/condiciones',
      'https://tenant.example/accesibilidad',
    ]);
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'issuanceInfo.footer.legalNotice',
      'issuanceInfo.footer.privacyPolicy',
      'issuanceInfo.footer.termsAndConditions',
      'issuanceInfo.footer.accessibility',
    ]);
  });

  it('AC-01: the support email, phone and schedule come from the tenant configuration', () => {
    const compiled = render(FULL_CONFIG);
    const footer = compiled.querySelector('[data-testid="footer-support"]');
    const helpEmail = compiled.querySelector<HTMLAnchorElement>('[data-testid="help-email"]');

    expect(footer?.querySelectorAll('li')).toHaveLength(3);
    expect(helpEmail?.textContent?.trim()).toBe('soporte@tenant.example');
    expect(helpEmail?.getAttribute('href')).toBe('mailto:soporte@tenant.example');
  });

  it('AC-01: no link points to "#"', () => {
    const compiled = render(FULL_CONFIG);

    expect(compiled.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  it('EC-01: a missing legal link or support detail is not shown', () => {
    const compiled = render({
      ...FULL_CONFIG,
      support: { phone: '911 000 000' },
      legal_links: { privacy: 'https://tenant.example/privacidad' },
    });

    expect(compiled.querySelectorAll('[data-testid="footer-legal"] a')).toHaveLength(1);
    expect(compiled.querySelectorAll('[data-testid="footer-support"] li')).toHaveLength(1);
    expect(compiled.querySelector('[data-testid="help-email"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="help-incident"]')).not.toBeNull();
  });

  it('EC-01: without any legal link or support detail, their footer blocks are not shown', () => {
    const compiled = render({ ...FULL_CONFIG, support: {}, legal_links: {} });

    expect(compiled.querySelector('[data-testid="footer-legal"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="footer-support"]')).toBeNull();
    expect(compiled.querySelector('footer')).not.toBeNull();
  });
});
