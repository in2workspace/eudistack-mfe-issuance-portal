import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { VerifyEmailComponent } from './verify-email.component';
import { ApiProblemError, NETWORK_ERROR } from '../../../core/api/api-problem.error';
import { EmailVerification, Journey, JourneyApi } from '../../../core/api/generated/journey';
import { TenantLanguageService } from '../../../core/branding/tenant-language.service';
import { JourneyIssuanceStore } from '../../../core/journey/journey-issuance.store';
import { JourneyNavigator } from '../../../core/journey/journey-navigator';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';

expect.extend(toHaveNoViolations);

const CODE = '482913';

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

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

describe('VerifyEmailComponent', () => {
  let fixture: ComponentFixture<VerifyEmailComponent>;
  let getJourney: jest.Mock<Observable<Journey>>;
  let checkEmailCode: jest.Mock<Observable<Journey>>;
  let sendEmailCode: jest.Mock<Observable<EmailVerification>>;
  let withdrawJourney: jest.Mock<Observable<Journey>>;
  let discardTokens: jest.Mock;
  let toSessionExpired: jest.Mock;
  let language: string;
  let navigate: jest.SpyInstance;
  let store: JourneyIssuanceStore;

  beforeEach(() => {
    getJourney = jest.fn();
    checkEmailCode = jest.fn();
    sendEmailCode = jest.fn();
    withdrawJourney = jest.fn();
    discardTokens = jest.fn();
    toSessionExpired = jest.fn().mockResolvedValue(true);
    language = 'es';
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [VerifyEmailComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: JourneyApi, useValue: { getJourney, checkEmailCode, sendEmailCode, withdrawJourney } },
        { provide: JourneyNavigator, useValue: { toSessionExpired } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), discardTokens } },
        { provide: TenantLanguageService, useValue: { current: () => language } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store = TestBed.inject(JourneyIssuanceStore);
  });

  afterEach(() => {
    fixture?.nativeElement.remove();
    jest.useRealTimers();
  });

  function create(current: EmailVerification | null = verification(), step: Journey.StepEnum = 'entitlement_confirmed'): void {
    getJourney.mockReturnValue(of({ state: 'in_progress', step, email_verification: current ?? undefined }));
    fixture = TestBed.createComponent(VerifyEmailComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const boxes = (): HTMLInputElement[] => Array.from(element().querySelectorAll('input'));
  const boxValues = (): string => boxes().map((box) => box.value).join('');
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(element().querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const message = (): string => element().querySelector('#verify-email-message')?.textContent?.trim() ?? '';
  const focusedBox = (): number => boxes().indexOf(document.activeElement as HTMLInputElement);

  function click(label: string): void {
    button(label)!.click();
    fixture.detectChanges();
  }

  function paste(text: string): void {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    boxes()[0].dispatchEvent(event);
    fixture.detectChanges();
  }

  function typeCode(code: string): void {
    code.split('').forEach((digit, index) => {
      boxes()[index].value = digit;
      boxes()[index].dispatchEvent(new Event('input'));
    });
    fixture.detectChanges();
  }

  it('while GET /journey answers, shows the waiting notice as a status region and no boxes', () => {
    getJourney.mockReturnValue(NEVER);
    fixture = TestBed.createComponent(VerifyEmailComponent);
    fixture.detectChanges();

    const status = Array.from(element().querySelectorAll('output, [role="status"]'));
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toContain(catalog('es')['verifyEmail.loading']);
    expect(boxes()).toHaveLength(0);
  });

  describe('entering (AC-09)', () => {
    it('shows the email the code was sent to, the 6 boxes and Reenviar with the countdown the service gives', () => {
      create(verification({ resend_available_at: new Date(Date.now() + 125_000).toISOString() }));

      expect(element().querySelector('h1')?.textContent).toBe('Verifica tu correo');
      expect(element().textContent).toContain('Te hemos enviado un código de 6 dígitos a');
      expect(element().textContent).toContain('maria@example.org');
      expect(boxes()).toHaveLength(6);
      expect(button('Reenviar en 02:05')?.disabled).toBe(true);
      expect(element().textContent).toContain('¿No te ha llegado?');
      expect(button('Cambiar el correo')).toBeDefined();
      expect(button('Cancelar')).toBeDefined();
    });

    it('AC-12: takes the focus to the first box', () => {
      create();

      expect(focusedBox()).toBe(0);
    });

    it('Reenviar is enabled when resend_available_at has passed', () => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));

      expect(button('Reenviar')?.disabled).toBe(false);
    });

    it('with the email verified (or no code sent) goes to the step the service says, not staying here', () => {
      create(verification({ verified: true }), 'email_verified');

      expect(navigate).toHaveBeenCalledWith(['/', 'offer']);
      expect(boxes()).toHaveLength(0);
    });

    it('with no email verification goes to Datos', () => {
      create(null);

      expect(navigate).toHaveBeenCalledWith(['/', 'user-data']);
    });

    it('a 410 from GET /journey goes to the session expired case', () => {
      getJourney.mockReturnValue(problem('journey_closed', 410));
      fixture = TestBed.createComponent(VerifyEmailComponent);
      fixture.detectChanges();

      expect(toSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('another failure of GET /journey goes to Inicio', () => {
      getJourney.mockReturnValue(problem(NETWORK_ERROR, 0));
      fixture = TestBed.createComponent(VerifyEmailComponent);
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('an already expired code, with sends left, says it no longer works', () => {
      create(verification({ code_expires_at: new Date(Date.now() - 1000).toISOString() }));

      expect(message()).toBe('Este código ya no sirve. Pide otro.');
      expect(boxes()).toHaveLength(6);
    });

    it('AC-09: leaves nothing of the holder in the browser storage', () => {
      create();
      checkEmailCode.mockReturnValue(NEVER);
      paste(CODE);

      const stored = [sessionStorage, localStorage].flatMap((storage) =>
        Array.from({ length: storage.length }, (_, i) => `${storage.key(i)}=${storage.getItem(storage.key(i)!)}`),
      );
      expect(stored.join('\n')).not.toMatch(/maria|example\.org|482913|@/);
    });
  });

  describe('checking the code', () => {
    it('AC-02: a right code goes to QR (generando), which confirms', () => {
      create();
      checkEmailCode.mockReturnValue(of({ state: 'in_progress', step: 'email_verified' }));

      typeCode(CODE);

      expect(checkEmailCode).toHaveBeenCalledWith({ code: CODE });
      expect(navigate).toHaveBeenCalledWith(['/', 'offer']);
    });

    it('EC-02: pasting the 6 digits fills the boxes and checks the code with no more actions', () => {
      create();
      checkEmailCode.mockReturnValue(of({ state: 'in_progress', step: 'email_verified' }));

      paste(CODE);

      expect(boxValues()).toBe(CODE);
      expect(checkEmailCode).toHaveBeenCalledTimes(1);
      expect(checkEmailCode).toHaveBeenCalledWith({ code: CODE });
    });

    it('does not check anything before the 6 digits are there', () => {
      create();

      typeCode('4829');

      expect(checkEmailCode).not.toHaveBeenCalled();
    });

    it('a second complete code while one is being checked is not sent', () => {
      create();
      checkEmailCode.mockReturnValue(NEVER);

      paste(CODE);
      paste('111111');

      expect(checkEmailCode).toHaveBeenCalledTimes(1);
    });

    it('if QR does not let the holder in, the holder can try again', async () => {
      navigate.mockResolvedValue(false);
      create();
      checkEmailCode.mockReturnValue(of({ state: 'in_progress', step: 'email_verified' }));
      paste(CODE);
      await fixture.whenStable();

      paste('111111');

      expect(checkEmailCode).toHaveBeenCalledTimes(2);
    });

    it('AC-03: a wrong code says so, empties the boxes and puts the focus on the first', () => {
      create();
      checkEmailCode.mockReturnValue(problem('invalid_code', 400));

      paste(CODE);

      expect(message()).toBe('El código no es correcto');
      expect(boxValues()).toBe('');
      expect(focusedBox()).toBe(0);
      expect(boxes()[0].getAttribute('aria-invalid')).toBe('true');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('AC-03: after a wrong code, the next one is checked', () => {
      create();
      checkEmailCode.mockReturnValueOnce(problem('invalid_code', 400)).mockReturnValueOnce(of({ state: 'in_progress', step: 'email_verified' }));
      paste(CODE);

      paste('111111');

      expect(checkEmailCode).toHaveBeenNthCalledWith(2, { code: '111111' });
      expect(navigate).toHaveBeenCalledWith(['/', 'offer']);
    });

    it.each(['expired_code', 'too_many_attempts'])(
      'AC-03: %s says the code no longer works, empties the boxes and focuses the first',
      (type) => {
        create();
        checkEmailCode.mockReturnValue(problem(type, 400));

        paste(CODE);

        expect(message()).toBe('Este código ya no sirve. Pide otro.');
        expect(boxValues()).toBe('');
        expect(focusedBox()).toBe(0);
        expect(boxes()[0].getAttribute('aria-invalid')).toBeNull();
      },
    );

    it('AC-03: when the code no longer works, Reenviar shows the countdown if it is not yet allowed', () => {
      create();
      checkEmailCode.mockReturnValue(problem('too_many_attempts', 400));

      paste(CODE);

      expect(button('Reenviar en 03:00')?.disabled).toBe(true);
    });

    it('AC-03: when the code no longer works and the wait has passed, Reenviar is enabled', () => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      checkEmailCode.mockReturnValue(problem('expired_code', 400));

      paste(CODE);

      expect(button('Reenviar')?.disabled).toBe(false);
    });

    it('any other failure says the code could not be checked and empties the boxes', () => {
      create();
      checkEmailCode.mockReturnValue(problem(NETWORK_ERROR, 0));

      paste(CODE);

      expect(message()).toBe('No hemos podido comprobar el código. Inténtalo de nuevo.');
      expect(boxValues()).toBe('');
    });

    it.each([
      ['step_not_allowed', 409],
      ['journey_closed', 410],
    ])('ES-04: %s is left to the journey interceptor: no message', (type, status) => {
      create();
      checkEmailCode.mockReturnValue(problem(type, status));

      paste(CODE);

      expect(message()).toBe('');
    });

    it('AC-12: the messages of the code go in an aria-live polite region that is there before they appear', () => {
      create(verification({ code_expires_at: new Date(Date.now() + 600_000).toISOString() }));
      const region = element().querySelector('#verify-email-message')!;
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.textContent?.trim()).toBe('');

      checkEmailCode.mockReturnValue(problem('invalid_code', 400));
      paste(CODE);

      expect(element().querySelector('#verify-email-message')).toBe(region);
      expect(region.textContent).toContain('El código no es correcto');
    });

    it('AC-12: the boxes point to the message region', () => {
      create();

      expect(boxes()[0].getAttribute('aria-describedby')).toBe('verify-email-message');
    });
  });

  describe('Reenviar (AC-04)', () => {
    it('counts down and enables Reenviar when the service allows another send', () => {
      jest.useFakeTimers();
      create(verification({ resend_available_at: new Date(Date.now() + 3000).toISOString() }));
      expect(button('Reenviar en 00:03')?.disabled).toBe(true);

      jest.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(button('Reenviar en 00:01')?.disabled).toBe(true);

      jest.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect(button('Reenviar')?.disabled).toBe(false);
    });

    it('does not send while the countdown runs', () => {
      create();

      button('Reenviar en 03:00')!.click();

      expect(sendEmailCode).not.toHaveBeenCalled();
    });

    it('sends a new code to the same email with the language being shown, takes the new countdown and announces it', () => {
      language = 'en';
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(of(verification({ sends_left: 1 })));
      paste(CODE.slice(0, 3));

      click('Reenviar');

      expect(sendEmailCode).toHaveBeenCalledWith({ email: 'maria@example.org' }, 'en');
      expect(button('Reenviar en 03:00')?.disabled).toBe(true);
      expect(message()).toBe('Te hemos enviado un código nuevo.');
      expect(boxValues()).toBe('');
      expect(focusedBox()).toBe(0);
    });

    it('a new code after one that no longer worked clears the message of the old one', () => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      checkEmailCode.mockReturnValue(problem('expired_code', 400));
      paste(CODE);
      sendEmailCode.mockReturnValue(of(verification({ sends_left: 1 })));

      click('Reenviar');

      expect(message()).not.toContain('ya no sirve');
    });

    it('a second click while sending sends no other code', () => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(NEVER);

      button('Reenviar')!.click();
      fixture.detectChanges();
      button('Reenviar')!.click();

      expect(sendEmailCode).toHaveBeenCalledTimes(1);
      expect(button('Reenviar')?.disabled).toBe(true);
    });

    it('resend_too_soon takes the countdown from Retry-After, with no message', () => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(problem('resend_too_soon', 429, 75));

      click('Reenviar');

      expect(button('Reenviar en 01:15')?.disabled).toBe(true);
      expect(message()).toBe('');
    });

    it('AC-05: too_many_requests shows the countdown of Retry-After in the message and in Reenviar, and ends with it', () => {
      jest.useFakeTimers();
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(problem('too_many_requests', 429, 120));

      click('Reenviar');

      expect(message()).toBe('Ahora no se pueden enviar más códigos. Inténtalo de nuevo en 02:00.');
      expect(button('Reenviar en 02:00')?.disabled).toBe(true);

      jest.advanceTimersByTime(121_000);
      fixture.detectChanges();

      expect(message()).toBe('');
      expect(button('Reenviar')?.disabled).toBe(false);
    });

    it('AC-05: too_many_requests with no Retry-After says to try again later and leaves Reenviar enabled', () => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(problem('too_many_requests', 429));

      click('Reenviar');

      expect(message()).toBe('Ahora no se pueden enviar más códigos. Inténtalo de nuevo más tarde.');
      expect(button('Reenviar')?.disabled).toBe(false);
    });

    it.each([
      ['email_unavailable', 503],
      [NETWORK_ERROR, 0],
    ])('AC-06: %s says the code cannot be sent now and keeps the old code usable', (type, status) => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(problem(type, status));

      click('Reenviar');

      expect(message()).toBe('Ahora no se puede enviar el código. Inténtalo de nuevo.');
      expect(boxes()).toHaveLength(6);
      expect(button('Reenviar')?.disabled).toBe(false);
    });

    it.each([
      ['step_not_allowed', 409],
      ['journey_closed', 410],
    ])('ES-04: %s is left to the journey interceptor: no message', (type, status) => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(problem(type, status));

      click('Reenviar');

      expect(message()).toBe('');
    });
  });

  describe('no more codes (AC-05)', () => {
    it('too_many_codes when resending says no more codes can be sent and offers Volver al inicio instead of the boxes', () => {
      create(verification({ resend_available_at: new Date(Date.now() - 1000).toISOString() }));
      sendEmailCode.mockReturnValue(problem('too_many_codes', 429));

      click('Reenviar');

      expect(message()).toBe('No se pueden enviar más códigos. Vuelve al inicio para empezar de nuevo.');
      expect(boxes()).toHaveLength(0);
      expect(button('Volver al inicio')).toBeDefined();
      expect(button('Cambiar el correo')).toBeUndefined();
      expect(element().textContent).not.toContain('¿No te ha llegado?');
      expect(button('Cancelar')).toBeDefined();
    });

    it('no sends left and a code that no longer works shows the same state on entering', () => {
      create(verification({ sends_left: 0, code_expires_at: new Date(Date.now() - 1000).toISOString() }));

      expect(message()).toContain('No se pueden enviar más códigos');
      expect(boxes()).toHaveLength(0);
      expect(button('Volver al inicio')).toBeDefined();
    });

    it('no sends left but a code still valid keeps the boxes, and shows the state when the code expires', () => {
      jest.useFakeTimers();
      create(verification({ sends_left: 0, code_expires_at: new Date(Date.now() + 5000).toISOString() }));
      expect(boxes()).toHaveLength(6);
      expect(button('Volver al inicio')).toBeUndefined();

      jest.advanceTimersByTime(6000);
      fixture.detectChanges();

      expect(boxes()).toHaveLength(0);
      expect(button('Volver al inicio')).toBeDefined();
    });

    it('the last code rejected with no sends left shows the state', () => {
      create(verification({ sends_left: 0 }));
      checkEmailCode.mockReturnValue(problem('too_many_attempts', 400));

      paste(CODE);

      expect(message()).toContain('No se pueden enviar más códigos');
      expect(button('Volver al inicio')).toBeDefined();
    });

    it('Volver al inicio withdraws the journey, discards the tokens, forgets what QR kept and goes to Inicio, without confirmation', () => {
      create(verification({ sends_left: 0, code_expires_at: new Date(Date.now() - 1000).toISOString() }));
      withdrawJourney.mockReturnValue(of({ state: 'withdrawn', step: 'entitlement_confirmed' }));
      store.requestConfirmation();

      click('Volver al inicio');

      expect(element().querySelector('[role="dialog"]')).toBeNull();
      expect(withdrawJourney).toHaveBeenCalledTimes(1);
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(store.pendingCall()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('if the withdrawal fails, discards the tokens and goes to Inicio anyway', () => {
      create(verification({ sends_left: 0, code_expires_at: new Date(Date.now() - 1000).toISOString() }));
      withdrawJourney.mockReturnValue(problem(NETWORK_ERROR, 0));

      click('Volver al inicio');

      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('with a 410 leaves the navigation to the journey interceptor', () => {
      create(verification({ sends_left: 0, code_expires_at: new Date(Date.now() - 1000).toISOString() }));
      withdrawJourney.mockReturnValue(problem('journey_closed', 410));

      click('Volver al inicio');

      expect(navigate).not.toHaveBeenCalled();
    });

    it('withdraws only once while the withdrawal is running', () => {
      create(verification({ sends_left: 0, code_expires_at: new Date(Date.now() - 1000).toISOString() }));
      withdrawJourney.mockReturnValue(new Subject<Journey>());

      button('Volver al inicio')!.click();
      fixture.detectChanges();
      button('Volver al inicio')!.click();

      expect(withdrawJourney).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cambiar el correo (AC-07)', () => {
    it('goes back to Datos', () => {
      create();

      click('Cambiar el correo');

      expect(navigate).toHaveBeenCalledWith(['/', 'user-data']);
      expect(withdrawJourney).not.toHaveBeenCalled();
    });
  });

  describe('Cancelar', () => {
    it('asks for confirmation before withdrawing, with the same notice as Datos', () => {
      create();

      click('Cancelar');

      expect(element().querySelector('[role="dialog"]')?.textContent).toContain('¿Seguro que quieres cancelar?');
      expect(withdrawJourney).not.toHaveBeenCalled();
    });

    it('«Seguir» closes the notice and calls nothing', () => {
      create();
      click('Cancelar');

      click('Seguir');

      expect(element().querySelector('[role="dialog"]')).toBeNull();
      expect(withdrawJourney).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('«Sí, cancelar» withdraws the journey, discards the tokens and goes to Inicio', () => {
      create();
      withdrawJourney.mockReturnValue(of({ state: 'withdrawn', step: 'entitlement_confirmed' }));
      click('Cancelar');

      click('Sí, cancelar');

      expect(withdrawJourney).toHaveBeenCalledTimes(1);
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('textos y accesibilidad', () => {
    it.each(['es', 'en'])('has every Verificar correo text in %s', (lang) => {
      const texts = catalog(lang);
      const keys = Object.keys(catalog('es')).filter((key) => key.startsWith('verifyEmail.') || key.startsWith('userData.sendError.'));

      expect(keys.length).toBeGreaterThan(0);
      keys.forEach((key) => expect(texts[key]).toBeTruthy());
      expect(Object.keys(texts).filter((key) => key.startsWith('verifyEmail.')).sort()).toEqual(
        Object.keys(catalog('es')).filter((key) => key.startsWith('verifyEmail.')).sort(),
      );
    });

    it('NFR-3: has no accessibility violations', async () => {
      create();

      expect(await axe(element())).toHaveNoViolations();
    });

    it('NFR-3: has no accessibility violations with a wrong code', async () => {
      create();
      checkEmailCode.mockReturnValue(problem('invalid_code', 400));
      paste(CODE);

      expect(await axe(element())).toHaveNoViolations();
    });

    it('NFR-3: has no accessibility violations with no more codes', async () => {
      create(verification({ sends_left: 0, code_expires_at: new Date(Date.now() - 1000).toISOString() }));

      expect(await axe(element())).toHaveNoViolations();
    });

    it('NFR-3: has no accessibility violations with the cancel notice open', async () => {
      create();
      click('Cancelar');

      expect(await axe(element())).toHaveNoViolations();
    });

    it('NFR-3: has no accessibility violations while loading', async () => {
      getJourney.mockReturnValue(NEVER);
      fixture = TestBed.createComponent(VerifyEmailComponent);
      document.body.appendChild(fixture.nativeElement);
      fixture.detectChanges();

      expect(await axe(element())).toHaveNoViolations();
    });
  });
});
