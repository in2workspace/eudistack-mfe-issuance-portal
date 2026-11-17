import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { UserDataComponent } from './user-data.component';
import { ApiProblemError, NETWORK_ERROR } from '../../../core/api/api-problem.error';
import { AttestationPreview, Journey, JourneyApi, JourneyRequest } from '../../../core/api/generated/journey';
import { JourneyIssuanceStore } from '../../../core/journey/journey-issuance.store';
import { JourneyNavigator } from '../../../core/journey/journey-navigator';
import { SESSION_ACTIONS } from '../../../core/session/session-actions';

expect.extend(toHaveNoViolations);

const PREVIEW: AttestationPreview = {
  type_name: 'DoctorID',
  fields: [
    { label: 'Nombre', value: 'María García López' },
    { label: 'Número de colegiado', value: '282801234' },
  ],
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
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ requestId: 'r2' }) } } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store = TestBed.inject(JourneyIssuanceStore);
  });

  const requests = (target: JourneyRequest = { id: 'r2', status: 'available', attestation: PREVIEW }): JourneyRequest[] => [
    { id: 'r1', status: 'available', attestation: { type_name: 'Otra', fields: [{ label: 'Otro', value: 'otro valor' }] } },
    target,
  ];

  function create(list: JourneyRequest[] = requests()): void {
    getJourney.mockReturnValue(
      of({
        state: 'in_progress',
        step: 'email_verified',
        email_verification: {
          email: 'maria@example.org',
          verified: true,
          resend_available_at: new Date().toISOString(),
          sends_left: 2,
        },
        requests: list,
      }),
    );
    fixture = TestBed.createComponent(UserDataComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  afterEach(() => fixture?.nativeElement.remove());

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const button = (label: string): HTMLButtonElement =>
    Array.from(element().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;

  function click(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  it('while GET /journey answers, shows the waiting notice as a status region and no data', () => {
    getJourney.mockReturnValue(NEVER);
    fixture = TestBed.createComponent(UserDataComponent);
    fixture.detectChanges();

    const status = statusRegions(element());
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toContain(catalog('es')['userData.loading']);
    expect(element().querySelector('dl')).toBeNull();
  });

  describe('data of the request of the route (AD-9)', () => {
    it('AC-24: shows the attestation name and every field of that request as the service gives it', () => {
      create();

      expect(element().textContent).toContain('Datos de tu DoctorID');
      const terms = Array.from(element().querySelectorAll('dt')).map((dt) => dt.textContent?.trim());
      const values = Array.from(element().querySelectorAll('dd')).map((dd) => dd.textContent?.trim());
      expect(terms).toEqual(['Nombre', 'Número de colegiado']);
      expect(values).toEqual(['María García López', '282801234']);
      expect(element().textContent).not.toContain('otro valor');
    });

    it('EC-05: with no fields shows the attestation name and can continue', () => {
      create(requests({ id: 'r2', status: 'available', attestation: { type_name: 'DoctorID', fields: [] } }));

      expect(element().querySelector('dl')).toBeNull();
      expect(element().textContent).toContain('Datos de tu DoctorID');
      expect(button('Son correctos, continuar').disabled).toBe(false);
    });

    it('has no email field: the email is verified in Correo', () => {
      create();

      expect(element().querySelector('input')).toBeNull();
    });

    it.each<[string, JourneyRequest[]]>([
      ['not of the journey', [{ id: 'r1', status: 'available' }]],
      ['saved', requests({ id: 'r2', status: 'saved' })],
      ['not available', requests({ id: 'r2', status: 'not_available', not_available_reason: 'under_review' })],
    ])('EC-07: a request %s goes to the step the journey says', (_name, list) => {
      create(list);

      expect(navigate).toHaveBeenCalledWith(expect.any(Array), { replaceUrl: true });
      expect(element().querySelector('dl')).toBeNull();
    });
  });

  describe('Son correctos, continuar', () => {
    it('goes to the QR of the request, which confirms it', () => {
      create();

      click('Son correctos, continuar');

      expect(navigate).toHaveBeenCalledWith(['/', 'requests', 'r2', 'offer']);
    });

    it('EC-07: a second click while going to QR does not navigate again', () => {
      navigate.mockReturnValue(new Promise(() => undefined));
      create();

      button('Son correctos, continuar').click();
      button('Son correctos, continuar').click();

      expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('if QR does not let the holder in, the button works again', async () => {
      navigate.mockResolvedValue(false);
      create();

      button('Son correctos, continuar').click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(button('Son correctos, continuar').disabled).toBe(false);
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

  describe('Cancelar (AC-22)', () => {
    it('asks for confirmation before withdrawing', () => {
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

    it('«Sí, cancelar» withdraws the journey, discards the tokens, forgets the pending call and goes to Inicio', () => {
      withdrawJourney.mockReturnValue(of({ state: 'withdrawn', step: 'entitlement_confirmed' }));
      store.requestConfirmation('r2');
      create();
      click('Cancelar');

      click('Sí, cancelar');

      expect(withdrawJourney).toHaveBeenCalledTimes(1);
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(store.pending()).toBeNull();
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
      store.requestConfirmation('r2');
      create();
      click('Cancelar');

      click('Sí, cancelar');

      expect(navigate).not.toHaveBeenCalled();
      expect(store.pending()).toBeNull();
    });

    it('EC-07: withdraws only once while the withdrawal is running', () => {
      withdrawJourney.mockReturnValue(new Subject<Journey>());
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
