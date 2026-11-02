import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BehaviorSubject } from 'rxjs';
import { ErrorComponent } from './error.component';
import { ERROR_REASONS, ErrorReason } from './error-reason';
import { PortalConfigService, PortalConfigState } from '../../core/config/portal-config.service';
import { TenantLanguageService } from '../../core/branding/tenant-language.service';
import { SESSION_ACTIONS, SessionActions } from '../../core/session/session-actions';
import { PortalConfig, PortalConfigSupport } from '../../core/api/generated/journey';

expect.extend(toHaveNoViolations);

describe('ErrorComponent', () => {
  let fixture: ComponentFixture<ErrorComponent>;
  let router: Router;
  let session: jest.Mocked<SessionActions>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let data: BehaviorSubject<Record<string, unknown>>;
  let load: jest.Mock<Promise<PortalConfigState>>;
  let reloadTexts: jest.Mock;
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
    actionButton().click();
    await fixture.whenStable();
  }

  function actionButton(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
  }

  /** La ruta de configuración no disponible lleva el caso en `data`, sin parámetro. */
  function showConfigUnavailable(): HTMLElement {
    data.next({ reason: 'config-unavailable' });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({}));
    data = new BehaviorSubject<Record<string, unknown>>({});
    load = jest.fn();
    reloadTexts = jest.fn().mockResolvedValue(undefined);
    session = { restartLogin: jest.fn().mockResolvedValue(undefined), discardTokens: jest.fn() };
    config.set(configWith({ email: 'soporte@cgcom.example', phone: '900 000 000', schedule: 'L-V 9-18' }));
    TestBed.configureTestingModule({
      imports: [ErrorComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params, data } },
        { provide: SESSION_ACTIONS, useValue: session },
        { provide: PortalConfigService, useValue: { config, load } },
        { provide: TenantLanguageService, useValue: { reloadTexts } },
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

  describe('config-unavailable', () => {
    const loaded: PortalConfigState = { status: 'loaded', config: configWith({}) };

    it('AC-05: takes the case from the route data and shows it with no internal detail', () => {
      const text = showConfigUnavailable().textContent ?? '';

      expect(text).toContain('error.config-unavailable.title');
      expect(text).not.toMatch(/\b[45]\d{2}\b|config_unavailable|GET \/config|Problem/);
    });

    it('AC-05: once GET /config answers, retrying reloads the texts with the tenant ones and goes to Inicio', async () => {
      load.mockResolvedValue(loaded);
      showConfigUnavailable();

      await fixture.componentInstance.onAction();

      expect(reloadTexts).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('AC-05: goes to Inicio only once the tenant texts are in place', async () => {
      let textsLoaded!: () => void;
      reloadTexts.mockReturnValue(new Promise<void>((r) => (textsLoaded = r)));
      load.mockResolvedValue(loaded);
      showConfigUnavailable();

      const retry = fixture.componentInstance.onAction();
      await Promise.resolve();
      await Promise.resolve();
      expect(router.navigate).not.toHaveBeenCalled();

      textsLoaded();
      await retry;
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('ES-03: if the tenant texts cannot be reloaded, retrying stays on this case', async () => {
      reloadTexts.mockRejectedValue(new Error('texts'));
      load.mockResolvedValue(loaded);
      showConfigUnavailable();

      await fixture.componentInstance.onAction();
      fixture.detectChanges();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(actionButton().disabled).toBe(false);
    });

    it('ES-03: if it is still unavailable, retrying stays on this case', async () => {
      load.mockResolvedValue({ status: 'unavailable' });
      showConfigUnavailable();

      await fixture.componentInstance.onAction();
      fixture.detectChanges();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(actionButton().disabled).toBe(false);
    });

    it('ES-03: the button is disabled and a second retry is ignored while one is running', async () => {
      let resolve!: (state: PortalConfigState) => void;
      load.mockReturnValue(new Promise((r) => (resolve = r)));
      showConfigUnavailable();

      const first = fixture.componentInstance.onAction();
      fixture.detectChanges();
      expect(actionButton().disabled).toBe(true);
      await fixture.componentInstance.onAction();
      resolve({ status: 'unavailable' });
      await first;

      expect(load).toHaveBeenCalledTimes(1);
    });

    it('has no accessibility violations', async () => {
      expect(await axe(showConfigUnavailable())).toHaveNoViolations();
    });
  });

  it('EC-03: an unknown case renders nothing', () => {
    expect(show('anything').querySelector('main')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    expect(await axe(show('not-entitled'))).toHaveNoViolations();
  });

  /** Con los catálogos reales del producto: lo que ve el titular, no las claves. */
  describe('with the real texts', () => {
    function catalog(lang: string): Record<string, string> {
      return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<string, string>;
    }

    function useLanguage(lang: string): void {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation(lang, catalog(lang));
      translate.use(lang);
    }

    function textOf(element: HTMLElement, selector: string): string {
      return element.querySelector(selector)?.textContent?.trim() ?? '';
    }

    it.each<[ErrorReason, string, string]>([
      ['config-unavailable', 'Ahora no se puede continuar', 'Volver a intentarlo'],
      ['identification-failed', 'No se ha completado la identificación', 'Volver a intentarlo'],
      ['not-entitled', 'No constas con derecho a esta atestación', 'Volver al inicio'],
      ['source-unavailable', 'Ahora no podemos comprobar tus datos', 'Volver a intentarlo'],
      ['issuance-failed', 'No hemos podido generar tu atestación', 'Volver a intentarlo'],
      ['onboarding-unavailable', 'No hemos podido preparar tu alta en el wallet', 'Generar un código nuevo'],
      ['offer-not-renewable', 'Este código ya no se puede renovar', 'Volver al inicio'],
      ['session-expired', 'Tu sesión ha caducado', 'Empezar de nuevo'],
    ])('AC-03: %s shows the title «%s» and the action «%s»', (reason, title, action) => {
      useLanguage('es');

      const element = show(reason);

      expect(textOf(element, 'h1')).toBe(title);
      expect(textOf(element, 'button')).toBe(action);
    });

    it('AC-06: onboarding-unavailable says no attestation has been issued', () => {
      useLanguage('es');

      expect(textOf(show('onboarding-unavailable'), 'p')).toContain('No se ha emitido ninguna atestación');
    });

    it('AC-07: offer-not-renewable says there is nothing else to do if the attestation is already saved', () => {
      useLanguage('es');

      expect(textOf(show('offer-not-renewable'), 'p')).toContain(
        'Si ya has guardado la atestación en tu wallet, no tienes que hacer nada más',
      );
    });

    it('AC-10: not-entitled shows the tenant support details in the text', () => {
      useLanguage('es');

      const support = show('not-entitled').querySelector('[data-testid="error-support"]')?.textContent ?? '';

      expect(support).toContain('soporte@cgcom.example');
      expect(support).toContain('900 000 000');
      expect(support).toContain('L-V 9-18');
    });

    describe.each(['es', 'en'])('in %s', (lang) => {
      it.each(ERROR_REASONS)('AC-10: %s shows no code, status, system name or untranslated key', (reason) => {
        useLanguage(lang);

        const text = show(reason).textContent ?? '';

        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toMatch(
          /\b[45]\d{2}\b|journey_closed|step_not_allowed|offer_not_renewable|onboarding_unavailable|config_unavailable|not_entitled|issuance_(rejected|unavailable)|authentic_source|Verifier|Wallet Unit Service|GET \/|POST \/|Problem|error\.|\{\{/,
        );
      });
    });
  });
});
