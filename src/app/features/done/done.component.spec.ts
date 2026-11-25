import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { DoneComponent } from './done.component';
import { ApiProblemError, NETWORK_ERROR } from '../../core/api/api-problem.error';
import { Journey, JourneyApi, JourneyRequest } from '../../core/api/generated/journey';
import { JourneyIssuanceStore } from '../../core/journey/journey-issuance.store';
import { JourneyNavigator } from '../../core/journey/journey-navigator';
import { journeyStepGuard } from '../../core/journey/journey-step.guard';
import { SESSION_ACTIONS } from '../../core/session/session-actions';
import { routes } from '../../app.routes';

expect.extend(toHaveNoViolations);

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

const SAVED: JourneyRequest[] = [
  { id: 'r1', status: 'saved', organization: 'Colegio de Madrid', display_identifier: '28/123456' },
  { id: 'r2', status: 'saved', organization: 'Colegio de Toledo', display_identifier: '45/654321' },
];
const PROBLEM: JourneyRequest = {
  id: 'r3',
  status: 'not_available',
  not_available_reason: 'identity_mismatch',
  organization: 'Colegio de Segovia',
  display_identifier: '40/222222',
};

describe('DoneComponent', () => {
  let fixture: ComponentFixture<DoneComponent>;
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
      imports: [DoneComponent, TranslateModule.forRoot()],
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

  afterEach(() => fixture?.nativeElement.remove());

  function create(requests: JourneyRequest[]): void {
    getJourney.mockReturnValue(of({ state: 'completed', step: 'offer_obtained', requests }));
    fixture = TestBed.createComponent(DoneComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const button = (label: string): HTMLButtonElement | undefined =>
    Array.from(element().querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const items = (testId: string): string[] =>
    Array.from(element().querySelectorAll(`[data-testid="${testId}"] li`)).map((li) => li.textContent?.trim() ?? '');

  it('AC-09: is a route protected by the step guard (active journey, 410 means session expired)', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];

    expect(screens.find((r) => r.path === 'done')?.canActivate).toEqual([journeyStepGuard]);
  });

  it('while GET /journey answers, shows the waiting notice as a status region', () => {
    getJourney.mockReturnValue(NEVER);
    fixture = TestBed.createComponent(DoneComponent);
    fixture.detectChanges();

    expect(element().querySelectorAll('output')).toHaveLength(1);
    expect(element().querySelector('h1')).toBeNull();
  });

  describe('AC-09: saved, a problem and one pending', () => {
    beforeEach(() => create([...SAVED, PROBLEM, { id: 'r4', status: 'available' }]));

    it('shows how many attestations are saved and which', () => {
      expect(element().querySelector('h1')?.textContent).toBe('Ya tienes tu atestación en tu cartera');
      expect(element().textContent).toContain('Has guardado 2 atestaciones en tu cartera');
      expect(items('saved')).toEqual(['Colegio de Madrid · N.º 28/123456', 'Colegio de Toledo · N.º 45/654321']);
    });

    it('shows the request with a problem and what to do', () => {
      const problems = items('problems');

      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('Colegio de Segovia · N.º 40/222222');
      expect(problems[0]).toContain('Tus datos de origen no coinciden con tu certificado. Pide que los actualicen.');
    });

    it('says how many are left and offers Volver a mis solicitudes, which goes to Solicitudes', () => {
      expect(element().querySelector('[data-testid="pending"]')?.textContent).toContain('Te queda 1 solicitud');

      button('Volver a mis solicitudes')!.click();

      expect(navigate).toHaveBeenCalledWith(['/', 'requests']);
    });
  });

  it('says how many are left in the plural', () => {
    create([SAVED[0], { id: 'r4', status: 'available' }, { id: 'r5', status: 'in_offer' }]);

    expect(element().textContent).toContain('Has guardado 1 atestación en tu cartera');
    expect(element().querySelector('[data-testid="pending"]')?.textContent).toContain('Te quedan 2 solicitudes');
  });

  it('with none pending shows no count and no Volver a mis solicitudes', () => {
    create([...SAVED, PROBLEM]);

    expect(element().querySelector('[data-testid="pending"]')).toBeNull();
    expect(button('Volver a mis solicitudes')).toBeUndefined();
    expect(button('Salir')).toBeDefined();
  });

  it('with nothing saved says so', () => {
    create([PROBLEM, { id: 'r4', status: 'available' }]);

    expect(element().querySelector('h1')?.textContent).toBe('No has guardado ninguna atestación');
    expect(element().querySelector('[data-testid="saved"]')).toBeNull();
  });

  it('never shows the opaque id of a request', () => {
    create([...SAVED, PROBLEM]);

    expect(element().textContent).not.toMatch(/\br[1-3]\b/);
  });

  describe('Salir (FR-09, FR-12)', () => {
    it('withdraws the journey, discards the tokens, forgets what is in memory and goes to Inicio', () => {
      withdrawJourney.mockReturnValue(of({ state: 'completed', step: 'offer_obtained' }));
      store.requestConfirmation('r1');
      create(SAVED);

      button('Salir')!.click();

      expect(withdrawJourney).toHaveBeenCalledTimes(1);
      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(store.pending()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('ES-05: if the withdrawal fails, discards the tokens and goes to Inicio anyway', () => {
      withdrawJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));
      create(SAVED);

      button('Salir')!.click();

      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('ES-08: with a 410 leaves the navigation to the journey interceptor', () => {
      withdrawJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));
      create(SAVED);

      button('Salir')!.click();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('withdraws only once while it is running', () => {
      withdrawJourney.mockReturnValue(new Subject<Journey>());
      create(SAVED);

      button('Salir')!.click();
      fixture.detectChanges();
      button('Salir')!.click();

      expect(withdrawJourney).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /journey fails', () => {
    it('a 410 goes to the session expired case', () => {
      getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));
      fixture = TestBed.createComponent(DoneComponent);
      fixture.detectChanges();

      expect(toSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('any other failure goes to Inicio', () => {
      getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));
      fixture = TestBed.createComponent(DoneComponent);
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  it.each(['es', 'en'])('has every Final text in %s', (lang) => {
    const texts = catalog(lang);
    const keys = Object.keys(catalog('es')).filter((key) => key.startsWith('done.'));

    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => expect(texts[key]).toBeTruthy());
  });

  it('NFR-5: has no accessibility violations with saved, a problem and pending requests', async () => {
    create([...SAVED, PROBLEM, { id: 'r4', status: 'available' }]);

    expect(await axe(element())).toHaveNoViolations();
  });

  it('NFR-5: has no accessibility violations with nothing saved', async () => {
    create([PROBLEM]);

    expect(await axe(element())).toHaveNoViolations();
  });
});
