import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PortalConfig } from '../../../core/api/generated/journey';
import { PortalConfigService } from '../../../core/config/portal-config.service';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { IssuanceInfoComponent } from './issuance-info.component';

expect.extend(toHaveNoViolations);

/** Configuración completa, para que la comprobación cubra la franja de ayuda, los enlaces legales y el soporte. */
const FULL_CONFIG: PortalConfig = {
  wallet_url: 'https://wallet.example',
  texts: {},
  support: { email: 'soporte@tenant.example', phone: '911 000 000', schedule: 'L-V 8:00-15:00' },
  legal_links: {
    legal_notice: 'https://tenant.example/aviso',
    privacy: 'https://tenant.example/privacidad',
    terms: 'https://tenant.example/condiciones',
    accessibility: 'https://tenant.example/accesibilidad',
  },
};

describe('IssuanceInfoComponent a11y', () => {
  let fixture: ComponentFixture<IssuanceInfoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IssuanceInfoComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), discardTokens: jest.fn() } },
        { provide: PortalConfigService, useValue: { config: signal(FULL_CONFIG) } },
      ],
    });

    fixture = TestBed.createComponent(IssuanceInfoComponent);
    fixture.detectChanges();
  });

  it('the CTA is a native <button> — keyboard-operable via Enter/Space by browser semantics (EC-01)', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('the CTA exposes an accessible name via aria-label (AC-03)', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(button?.getAttribute('aria-label')?.trim().length).toBeGreaterThan(0);
  });

  it('the screen uses a single h1', () => {
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');

    expect(headings.length).toBe(1);
  });

  it('the CTA declares a >=44x44px touch target via design tokens (structural check; real layout is not computable in jsdom)', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');

    expect(button?.className).toMatch(/min-h-\[44px\]/);
    expect(button?.className).toMatch(/min-w-\[44px\]/);
  });

  it('has no automatically detectable structural a11y violations (jest-axe)', async () => {
    const results = await axe(fixture.nativeElement);

    expect(results).toHaveNoViolations();
  });
});
