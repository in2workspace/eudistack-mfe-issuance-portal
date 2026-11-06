import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Observable, of, Subject, throwError } from 'rxjs';
import { UserDataComponent } from './user-data.component';
import { ApiProblemError, NETWORK_ERROR } from '../../../core/api/api-problem.error';
import { AttestationPreview, Journey, JourneyApi } from '../../../core/api/generated/journey';
import { JourneyNavigator } from '../../../core/journey/journey-navigator';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';
import { JourneyIssuanceStore } from '../../journey-issuance/journey-issuance.store';

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

describe('UserDataComponent', () => {
  let fixture: ComponentFixture<UserDataComponent>;
  let getJourney: jest.Mock<Observable<Journey>>;
  let withdrawJourney: jest.Mock<Observable<Journey>>;
  let discardTokens: jest.Mock;
  let toSessionExpired: jest.Mock;
  let navigate: jest.SpyInstance;
  let store: JourneyIssuanceStore;

  beforeEach(() => {
    getJourney = jest.fn();
    withdrawJourney = jest.fn();
    discardTokens = jest.fn();
    toSessionExpired = jest.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [UserDataComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: JourneyApi, useValue: { getJourney, withdrawJourney } },
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

  function create(attestation: AttestationPreview | undefined = PREVIEW): void {
    getJourney.mockReturnValue(of({ state: 'in_progress', step: 'entitlement_confirmed', attestation }));
    fixture = TestBed.createComponent(UserDataComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  afterEach(() => fixture?.nativeElement.remove());

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

    it('back from QR, the email the holder wrote wins over the one the service knows', () => {
      store.confirm('escrito@example.org');

      create();

      expect(emailInput().value).toBe('escrito@example.org');
    });

    it('ES-04: an email the service rejected is shown marked as not valid', () => {
      store.confirm('rechazado@example.org');
      store.rejectEmail();

      create();

      expect(emailInput().value).toBe('rechazado@example.org');
      expect(emailInput().getAttribute('aria-invalid')).toBe('true');
      expect(button('Continuar').disabled).toBe(true);

      type('corregido@example.org');
      expect(button('Continuar').disabled).toBe(false);
    });
  });

  describe('Continuar', () => {
    it('AC-01: keeps the email in memory, asks QR for the confirmation and goes to QR', () => {
      create();
      type('maria@example.org');

      click('Continuar');

      expect(store.email()).toBe('maria@example.org');
      expect(store.pendingCall()).toBe('confirmation');
      expect(navigate).toHaveBeenCalledWith(['/', 'offer']);
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

    it('AC-12: «Sí, cancelar» withdraws the journey, discards the tokens, forgets the email and goes to Inicio', () => {
      withdrawJourney.mockReturnValue(of({ state: 'withdrawn', step: 'entitlement_confirmed' }));
      store.confirm('maria@example.org');
      create();
      click('Cancelar');

      click('Sí, cancelar');

      expect(withdrawJourney).toHaveBeenCalledTimes(1);
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(store.email()).toBeNull();
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
      store.confirm('maria@example.org');
      create();
      click('Cancelar');

      click('Sí, cancelar');

      expect(navigate).not.toHaveBeenCalled();
      expect(store.email()).toBeNull();
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
