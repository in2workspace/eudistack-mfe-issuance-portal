import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { UserDataComponent } from './user-data.component';
import { ApiProblemError, NETWORK_ERROR } from '../../../core/api/api-problem.error';
import { AttestationPreview, EmailVerification, Journey, JourneyApi } from '../../../core/api/generated/journey';
import { TenantLanguageService } from '../../../core/branding/tenant-language.service';
import { JourneyNavigator } from '../../../core/journey/journey-navigator';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { JourneyIssuanceStore } from '../../../core/journey/journey-issuance.store';

expect.extend(toHaveNoViolations);

const PREVIEW: AttestationPreview = {
  type_name: 'DoctorID',
  fields: [
    { label: 'Nombre', value: 'María García López' },
    { label: 'Número de colegiado', value: '282801234' },
  ],
  email: 'maria@example.org',
  email_required: true,
};

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

/** Las regiones con rol `status`: el explícito y el implícito de `<output>` (HTML-AAM). */
const statusRegions = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('output, [role="status"]'));

describe('UserDataComponent', () => {
  let fixture: ComponentFixture<UserDataComponent>;
  let getJourney: jest.Mock<Observable<Journey>>;
  let withdrawJourney: jest.Mock<Observable<Journey>>;
  let sendEmailCode: jest.Mock<Observable<EmailVerification>>;
  let language: string;
  let discardTokens: jest.Mock;
  let toSessionExpired: jest.Mock;
  let navigate: jest.SpyInstance;
  let store: JourneyIssuanceStore;

  beforeEach(() => {
    getJourney = jest.fn();
    withdrawJourney = jest.fn();
    sendEmailCode = jest.fn();
    language = 'es';
    discardTokens = jest.fn();
    toSessionExpired = jest.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [UserDataComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: JourneyApi, useValue: { getJourney, withdrawJourney, sendEmailCode } },
        { provide: TenantLanguageService, useValue: { current: () => language } },
        { provide: JourneyNavigator, useValue: { toSessionExpired } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), discardTokens } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store = TestBed.inject(JourneyIssuanceStore);
  });

  function create(
    attestation: AttestationPreview | undefined = PREVIEW,
    email_verification?: EmailVerification,
  ): void {
    getJourney.mockReturnValue(
      of({
        state: 'in_progress',
        step: email_verification?.verified ? 'email_verified' : 'entitlement_confirmed',
        attestation,
        email_verification,
      }),
    );
    fixture = TestBed.createComponent(UserDataComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  afterEach(() => fixture?.nativeElement.remove());

  function verification(overrides: Partial<EmailVerification> = {}): EmailVerification {
    return {
      email: 'maria@example.org',
      verified: false,
      code_expires_at: new Date(Date.now() + 600_000).toISOString(),
      resend_available_at: new Date(Date.now() + 180_000).toISOString(),
      sends_left: 2,
      ...overrides,
    };
  }

  function problem(type: string, status: number, retryAfter?: number): Observable<never> {
    return throwError(() => new ApiProblemError(type, status, type, retryAfter));
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const emailInput = (): HTMLInputElement => element().querySelector('#holder-email')!;
  const button = (label: string): HTMLButtonElement =>
    Array.from(element().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;

  function type(value: string): void {
    emailInput().value = value;
    emailInput().dispatchEvent(new Event('input'));
    emailInput().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function click(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  it('while GET /journey answers, shows the waiting notice as a status region and no form', () => {
    getJourney.mockReturnValue(NEVER);
    fixture = TestBed.createComponent(UserDataComponent);
    fixture.detectChanges();

    const status = statusRegions(element());
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toContain(catalog('es')['userData.loading']);
    expect(element().querySelector('#holder-email')).toBeNull();
  });

  describe('preview and email', () => {
    it('AC-01: shows the attestation name and every field as the service gives it', () => {
      create();

      expect(element().textContent).toContain('Datos de tu DoctorID');
      const terms = Array.from(element().querySelectorAll('dt')).map((dt) => dt.textContent?.trim());
      const values = Array.from(element().querySelectorAll('dd')).map((dd) => dd.textContent?.trim());
      expect(terms).toEqual(['Nombre', 'Número de colegiado']);
      expect(values).toEqual(['María García López', '282801234']);
    });

    it('AC-01: fills the email the service knows and lets the holder change it', () => {
      create();

      expect(emailInput().value).toBe('maria@example.org');
      type('otra@example.org');
      expect(button('Continuar').disabled).toBe(false);
    });

    it('AC-01: shows the email field empty when the service does not know it', () => {
      create({ ...PREVIEW, email: undefined });

      expect(emailInput().value).toBe('');
      expect(button('Continuar').disabled).toBe(true);
    });

    it.each(['', 'maria', 'maria@', '@example.org'])('AC-01: Continuar stays disabled with %j', (value) => {
      create();

      type(value);

      expect(button('Continuar').disabled).toBe(true);
      expect(emailInput().getAttribute('aria-invalid')).toBe('true');
      expect(element().textContent).toContain('Escribe un correo electrónico válido.');
    });

    it('EC-05: with no fields shows the attestation name and the email, and can continue', () => {
      create({ type_name: 'DoctorID', fields: [], email_required: true });

      expect(element().querySelector('dl')).toBeNull();
      expect(element().textContent).toContain('Datos de tu DoctorID');
      type('maria@example.org');
      expect(button('Continuar').disabled).toBe(false);
    });

    it('AC-07: back from Verificar correo, the email the code was sent to wins over the one the source knows', () => {
      create(PREVIEW, verification({ email: 'escrito@example.org' }));

      expect(emailInput().value).toBe('escrito@example.org');
    });

    it('AC-07: back from Verificar correo with the email verified, shows it too', () => {
      create(PREVIEW, verification({ email: 'verificado@example.org', verified: true }));

      expect(emailInput().value).toBe('verificado@example.org');
    });
  });

  describe('Continuar', () => {
    beforeEach(() => sendEmailCode.mockReturnValue(of(verification())));

    it('AC-01: sends the code to the email, with the language being shown, and goes to Verificar correo', () => {
      create();
      type('maria@example.org');

      click('Continuar');

      expect(sendEmailCode).toHaveBeenCalledWith({ email: 'maria@example.org' }, 'es');
      expect(navigate).toHaveBeenCalledWith(['/', 'verify-email']);
    });

    it('AC-01: sends the language of the tenant being shown when the holder changed it', () => {
      language = 'en';
      create();

      click('Continuar');

      expect(sendEmailCode).toHaveBeenCalledWith({ email: 'maria@example.org' }, 'en');
    });

    it('AC-01: sends no language when none has been chosen yet', () => {
      language = '';
      create();

      click('Continuar');

      expect(sendEmailCode).toHaveBeenCalledWith({ email: 'maria@example.org' }, undefined);
    });

    it('EC-01: the email filled from the source goes out without the holder changing it', () => {
      create();

      click('Continuar');

      expect(sendEmailCode).toHaveBeenCalledWith({ email: 'maria@example.org' }, 'es');
    });

    it('EC-07 (service): an email with spaces around it is valid and goes out without them', () => {
      create();
      type(' maria@example.org ');

      click('Continuar');

      expect(sendEmailCode).toHaveBeenCalledWith({ email: 'maria@example.org' }, 'es');
    });

    it('EC-07: a second click while sending does not send another code', () => {
      sendEmailCode.mockReturnValue(NEVER);
      create();

      button('Continuar').click();
      button('Continuar').click();

      expect(sendEmailCode).toHaveBeenCalledTimes(1);
      fixture.detectChanges();
      expect(button('Continuar').disabled).toBe(true);
    });

    it('EC-07: a second click while going to Verificar correo does not send another code', () => {
      navigate.mockReturnValue(new Promise(() => undefined));
      create();

      button('Continuar').click();
      button('Continuar').click();

      expect(sendEmailCode).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('EC-07: if Verificar correo does not let the holder in, Continuar works again', async () => {
      navigate.mockResolvedValue(false);
      create();

      button('Continuar').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(button('Continuar').disabled).toBe(false);
    });

    it('AC-09: keeps the email nowhere but the field: the store holds no email', () => {
      create();
      type('maria@example.org');

      click('Continuar');

      expect('email' in store).toBe(false);
      expect(store.pendingCall()).toBeNull();
    });
  });

  describe('Continuar fails', () => {
    it.each(['email_required', 'email_invalid'])(
      'ES-01: %s marks the email as not valid in the field and Continuar stays disabled until it changes',
      (problemType) => {
        sendEmailCode.mockReturnValue(problem(problemType, 400));
        create();
        type('rechazado@example.org');

        click('Continuar');

        expect(navigate).not.toHaveBeenCalled();
        expect(emailInput().getAttribute('aria-invalid')).toBe('true');
        expect(element().textContent).toContain('Escribe un correo electrónico válido.');
        expect(button('Continuar').disabled).toBe(true);

        type('corregido@example.org');
        expect(button('Continuar').disabled).toBe(false);
      },
    );

    it('AC-06: email_unavailable stays in Datos with the notice, and Continuar tries again', () => {
      sendEmailCode.mockReturnValueOnce(problem('email_unavailable', 503)).mockReturnValueOnce(of(verification()));
      create();

      click('Continuar');

      expect(navigate).not.toHaveBeenCalled();
      expect(element().textContent).toContain('Ahora no se puede enviar el código.');
      expect(button('Continuar').disabled).toBe(false);

      click('Continuar');

      expect(sendEmailCode).toHaveBeenCalledTimes(2);
      expect(navigate).toHaveBeenCalledWith(['/', 'verify-email']);
      expect(element().textContent).not.toContain('Ahora no se puede enviar el código.');
    });

    it('AC-06: a failure with no answer is shown as email_unavailable', () => {
      sendEmailCode.mockReturnValue(problem(NETWORK_ERROR, 0));
      create();

      click('Continuar');

      expect(element().textContent).toContain('Ahora no se puede enviar el código.');
    });

    it('AC-05: too_many_requests shows the countdown of Retry-After and blocks Continuar until it ends', () => {
      jest.useFakeTimers();
      try {
        sendEmailCode.mockReturnValue(problem('too_many_requests', 429, 90));
        create();

        click('Continuar');

        expect(element().textContent).toContain('Ahora no se pueden enviar más códigos. Inténtalo de nuevo en 01:30.');
        expect(button('Continuar').disabled).toBe(true);
        expect(navigate).not.toHaveBeenCalled();

        jest.advanceTimersByTime(91_000);
        fixture.detectChanges();

        expect(element().textContent).not.toContain('Ahora no se pueden enviar más códigos');
        expect(button('Continuar').disabled).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    it('AC-05: too_many_requests with no Retry-After says to try again later and does not block Continuar', () => {
      sendEmailCode.mockReturnValue(problem('too_many_requests', 429));
      create();

      click('Continuar');

      expect(element().textContent).toContain('Inténtalo de nuevo más tarde.');
      expect(button('Continuar').disabled).toBe(false);
    });

    it.each(['resend_too_soon', 'too_many_codes'])(
      'AC-04, AC-05: %s is not an error in Datos: goes to Verificar correo, which says what is left',
      (problemType) => {
        sendEmailCode.mockReturnValue(problem(problemType, 429, 120));
        create();

        click('Continuar');

        expect(navigate).toHaveBeenCalledWith(['/', 'verify-email']);
        expect(element().textContent).not.toContain('Ahora no se pueden enviar');
      },
    );

    it.each([
      ['step_not_allowed', 409],
      ['journey_closed', 410],
    ])('ES-04: %s is left to the journey interceptor: no message and Continuar works again', (problemType, status) => {
      sendEmailCode.mockReturnValue(problem(problemType, status));
      create();

      click('Continuar');

      expect(navigate).not.toHaveBeenCalled();
      expect(element().textContent).not.toContain('Ahora no se puede enviar el código.');
      expect(button('Continuar').disabled).toBe(false);
    });
  });

  describe('GET /journey fails', () => {
    it('a 410 goes to the session expired case', () => {
      getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));
      fixture = TestBed.createComponent(UserDataComponent);
      fixture.detectChanges();

      expect(toSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('any other failure goes to Inicio', () => {
      getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));
      fixture = TestBed.createComponent(UserDataComponent);
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('Cancelar', () => {
    it('AC-12: asks for confirmation before withdrawing', () => {
      create();

      click('Cancelar');

      expect(element().querySelector('[role="dialog"]')?.textContent).toContain('¿Seguro que quieres cancelar?');
      expect(element().querySelector('[role="dialog"]')?.textContent).toContain('Tendrás que empezar de nuevo.');
      expect(withdrawJourney).not.toHaveBeenCalled();
    });

    it('AC-12: «Seguir» closes the notice, keeps what was written and calls nothing', () => {
      create();
      type('otra@example.org');
      click('Cancelar');

      click('Seguir');

      expect(element().querySelector('[role="dialog"]')).toBeNull();
      expect(emailInput().value).toBe('otra@example.org');
      expect(withdrawJourney).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('AC-12: «Sí, cancelar» withdraws the journey, discards the tokens, forgets the pending call and goes to Inicio', () => {
      withdrawJourney.mockReturnValue(of({ state: 'withdrawn', step: 'entitlement_confirmed' }));
      store.requestConfirmation();
      create();
      click('Cancelar');

      click('Sí, cancelar');

      expect(withdrawJourney).toHaveBeenCalledTimes(1);
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(store.pendingCall()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('ES-05: if the withdrawal fails, discards the tokens and goes to Inicio anyway', () => {
      withdrawJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));
      create();
      click('Cancelar');

      click('Sí, cancelar');

      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('ES-05: with a 410 leaves the navigation to the journey interceptor', () => {
      withdrawJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));
      store.requestConfirmation();
      create();
      click('Cancelar');

      click('Sí, cancelar');

      expect(navigate).not.toHaveBeenCalled();
      expect(store.pendingCall()).toBeNull();
    });

    it('EC-07: withdraws only once while the withdrawal is running', () => {
      const pending = new Subject<Journey>();
      withdrawJourney.mockReturnValue(pending);
      create();
      click('Cancelar');
      click('Sí, cancelar');

      click('Cancelar');

      expect(element().querySelector('[role="dialog"]')).toBeNull();
      expect(withdrawJourney).toHaveBeenCalledTimes(1);
    });
  });

  describe('textos y accesibilidad', () => {
    it.each(['es', 'en'])('NFR-2: has every Datos text in %s', (lang) => {
      const texts = catalog(lang);
      const keys = Object.keys(catalog('es')).filter((key) => key.startsWith('userData.'));

      expect(keys.length).toBeGreaterThan(0);
      keys.forEach((key) => expect(texts[key]).toBeTruthy());
    });

    it('NFR-3: has no accessibility violations', async () => {
      create();

      expect(await axe(element())).toHaveNoViolations();
    });

    it('NFR-3: has no accessibility violations with the cancel notice open', async () => {
      create();
      click('Cancelar');

      expect(await axe(element())).toHaveNoViolations();
    });
  });
});
