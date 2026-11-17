import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { RequestsComponent, statusTextOf } from './requests.component';
import { ApiProblemError, NETWORK_ERROR } from '../../core/api/api-problem.error';
import { Journey, JourneyApi, JourneyRequest } from '../../core/api/generated/journey';
import { JourneyNavigator } from '../../core/journey/journey-navigator';
import { journeyStepGuard } from '../../core/journey/journey-step.guard';
import { routes } from '../../app.routes';

expect.extend(toHaveNoViolations);

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

const OFFER = { credential_offer_uri: 'openid-credential-offer://?x=1', expires_at: '2099-01-01T00:00:00Z' };

/** Las cinco filas del wireframe más la de oferta en curso. */
const REQUESTS: JourneyRequest[] = [
  {
    id: 'r1',
    status: 'saved',
    organization: 'Colegio de Madrid',
    display_identifier: '28/123456',
    requested_by: 'Hospital Ejemplo Norte',
    requested_at: '2026-11-03T08:00:00Z',
  },
  {
    id: 'r2',
    status: 'available',
    organization: 'Colegio de Toledo',
    display_identifier: '45/654321',
    requested_by: 'Clínica Ejemplo Sur',
    requested_at: '2026-11-05T08:00:00Z',
  },
  { id: 'r3', status: 'available', renewal: true, organization: 'Colegio de Madrid', display_identifier: '28/777777' },
  { id: 'r4', status: 'not_available', not_available_reason: 'identifier_mismatch', display_identifier: '05/111111' },
  { id: 'r5', status: 'not_available', not_available_reason: 'identity_mismatch', requested_by: 'Clínica Ejemplo Sur' },
  { id: 'r6', status: 'not_available', not_available_reason: 'under_review' },
  { id: 'r7', status: 'in_offer', offer: OFFER, requested_at: '2026-11-08T08:00:00Z' },
];

describe('RequestsComponent', () => {
  let fixture: ComponentFixture<RequestsComponent>;
  let getJourney: jest.Mock<Observable<Journey>>;
  let toSessionExpired: jest.Mock;
  let navigate: jest.SpyInstance;

  beforeEach(() => {
    getJourney = jest.fn();
    toSessionExpired = jest.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [RequestsComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: JourneyApi, useValue: { getJourney } },
        { provide: JourneyNavigator, useValue: { toSessionExpired } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => fixture?.nativeElement.remove());

  function create(requests: JourneyRequest[] = REQUESTS): void {
    getJourney.mockReturnValue(of({ state: 'in_progress', step: 'email_verified', requests }));
    fixture = TestBed.createComponent(RequestsComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const rows = (): HTMLElement[] => Array.from(element().querySelectorAll('[data-testid="request"]'));

  it('AD-8: is the requests route, protected by the step guard', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];

    expect(screens.find((r) => r.path === 'requests')?.canActivate).toEqual([journeyStepGuard]);
  });

  it('title: how many requests and of which attestation, from the type name the service gives', () => {
    create([
      { id: 'r1', status: 'saved' },
      { id: 'r2', status: 'available', attestation: { type_name: 'DoctorID', fields: [] } },
      { id: 'r3', status: 'not_available', not_available_reason: 'identity_mismatch' },
    ]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Tienes 3 solicitudes de DoctorID');
    expect(root.querySelector('h1 + p')?.textContent?.trim()).toBe('Obtén un DoctorID por cada una.');
  });

  it('title: without any type name in the requests, a generic one with the count', () => {
    create([{ id: 'r1', status: 'saved' }, { id: 'r2', status: 'not_available', not_available_reason: 'under_review' }]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Tienes 2 solicitudes');
    expect(root.querySelector('h1 + p')?.textContent?.trim()).toBe('Obtén una atestación por cada una.');
  });

  it('asks GET /journey every time it is entered, to show the current status of each request', () => {
    create();
    TestBed.createComponent(RequestsComponent).detectChanges();

    expect(getJourney).toHaveBeenCalledTimes(2);
  });

  it('while GET /journey answers, shows the waiting notice as a status region and no list', () => {
    getJourney.mockReturnValue(NEVER);
    fixture = TestBed.createComponent(RequestsComponent);
    fixture.detectChanges();

    expect(element().querySelectorAll('output')).toHaveLength(1);
    expect(rows()).toHaveLength(0);
  });

  describe('each request (FR-14)', () => {
    it('AC-01: shows organisation, identifier, who asked for it and when', () => {
      create();

      const text = rows()[1].textContent ?? '';
      expect(text).toContain('Colegio de Toledo');
      expect(text).toContain('N.º 45/654321');
      expect(text).toContain('Pedida por Clínica Ejemplo Sur el 05/11/2026');
    });

    it('shows only what the source gives: no organisation and no identifier, no empty separators', () => {
      create();

      const text = rows()[4].textContent ?? '';
      expect(text).toContain('Pedida por Clínica Ejemplo Sur');
      expect(text).not.toContain('·');
      expect(text).not.toContain(' el ');
    });

    it('shows nothing about a request with nothing to recognise it by, but its status', () => {
      create();

      expect(rows()[5].textContent).toContain('Has dicho que tus datos no son correctos. Pide que los corrijan en su origen.');
    });

    it('never shows the opaque id of the request', () => {
      create();

      expect(element().textContent).not.toMatch(/\br[1-7]\b/);
    });

    it.each<[number, string]>([
      [0, 'Guardada en tu cartera'],
      [1, 'Pendiente'],
      [2, 'Renovación'],
      [3, 'No está a tu nombre. Pide a quien la solicitó que la revise.'],
      [4, 'Tus datos de origen no coinciden con tu certificado. Pide que los actualicen.'],
      [5, 'Has dicho que tus datos no son correctos'],
      [6, 'Pendiente de guardar en tu cartera'],
    ])('AC-01: row %s says its status in words: %s', (index, expected) => {
      create();

      expect(rows()[index].textContent).toContain(expected);
    });

    it('statusTextOf covers every status of the contract', () => {
      expect(statusTextOf({ id: 'a', status: 'not_available' })).toBe('notAvailable');
      expect(statusTextOf({ id: 'a', status: 'available' })).toBe('pending');
      expect(statusTextOf({ id: 'a', status: 'available', renewal: false })).toBe('pending');
    });
  });

  describe('Obtener (AC-01, EC-05)', () => {
    const getButton = (row: HTMLElement): HTMLButtonElement | undefined =>
      Array.from(row.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Obtener');

    it('is only on the available requests, renewals included', () => {
      create();

      expect(rows().map((row) => getButton(row) !== undefined)).toEqual([false, true, true, false, false, false, true]);
    });

    it('goes to the Datos of an available request, with its id in the route', () => {
      create();

      getButton(rows()[2])!.click();

      expect(navigate).toHaveBeenCalledWith(['/', 'requests', 'r3', 'data']);
    });

    it('on a request already in the process, goes on with its QR', () => {
      create();

      getButton(rows()[6])!.click();

      expect(navigate).toHaveBeenCalledWith(['/', 'requests', 'r7', 'offer']);
    });

    it('is described by the row, so several buttons are told apart', () => {
      create();

      const button = getButton(rows()[1])!;
      const described = element().querySelector(`#${button.getAttribute('aria-describedby')}`);

      expect(described?.textContent).toContain('Colegio de Toledo');
    });
  });

  it('FR-17: Terminar goes to Final', () => {
    create();

    Array.from(element().querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Terminar')!
      .click();

    expect(navigate).toHaveBeenCalledWith(['/', 'done']);
  });

  describe('GET /journey fails', () => {
    it('a 410 goes to the session expired case', () => {
      getJourney.mockReturnValue(throwError(() => new ApiProblemError('journey_closed', 410, 'Journey closed')));
      fixture = TestBed.createComponent(RequestsComponent);
      fixture.detectChanges();

      expect(toSessionExpired).toHaveBeenCalledTimes(1);
    });

    it('any other failure goes to Inicio', () => {
      getJourney.mockReturnValue(throwError(() => new ApiProblemError(NETWORK_ERROR, 0, 'Network error')));
      fixture = TestBed.createComponent(RequestsComponent);
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  it.each(['es', 'en'])('has every Solicitudes text in %s', (lang) => {
    const texts = catalog(lang);
    const keys = Object.keys(catalog('es')).filter((key) => key.startsWith('requests.'));

    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => expect(texts[key]).toBeTruthy());
  });

  it('NFR-5: has no accessibility violations', async () => {
    create();

    expect(await axe(element())).toHaveNoViolations();
  });

  it('NFR-5: has no accessibility violations while loading', async () => {
    getJourney.mockReturnValue(NEVER);
    fixture = TestBed.createComponent(RequestsComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    expect(await axe(element())).toHaveNoViolations();
  });
});
