import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { EntitlementComponent } from './entitlement.component';
import { ApiProblemError, NETWORK_ERROR, UNEXPECTED_ERROR } from '../../core/api/api-problem.error';
import { EntitlementApi, EntitlementResult, Request as SourceRequest } from '../../core/api/generated/authentic-source';
import { HolderAuthService } from '../../core/auth/holder-auth.service';
import { EntitlementOutcomeStore } from '../../core/journey/entitlement-outcome.store';
import { journeyStepGuard } from '../../core/journey/journey-step.guard';
import { routes } from '../../app.routes';
import { SESSION_ACTIONS } from '../../core/session/session-actions';

expect.extend(toHaveNoViolations);

/** Las regiones con rol `status`: el explícito y el implícito de `<output>` (HTML-AAM). */
const statusRegions = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('output, [role="status"]'));

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

const available: SourceRequest = { id: 'r1', status: 'available', renewal: false };

describe('EntitlementComponent', () => {
  let fixture: ComponentFixture<EntitlementComponent>;
  let verifyEntitlement: jest.Mock<Observable<EntitlementResult>>;
  let navigate: jest.SpyInstance;
  let discardTokens: jest.Mock;
  let restartLogin: jest.Mock;
  let givenName: WritableSignal<string>;
  let outcome: EntitlementOutcomeStore;

  function create(response: Observable<EntitlementResult>): void {
    verifyEntitlement.mockReturnValue(response);
    fixture = TestBed.createComponent(EntitlementComponent);
    fixture.detectChanges();
  }

  function problem(type: string, status: number): Observable<never> {
    return throwError(() => new ApiProblemError(type, status, type));
  }

  beforeEach(() => {
    verifyEntitlement = jest.fn();
    discardTokens = jest.fn();
    restartLogin = jest.fn().mockResolvedValue(undefined);
    givenName = signal('María');
    TestBed.configureTestingModule({
      imports: [EntitlementComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: EntitlementApi, useValue: { verifyEntitlement } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin, discardTokens } },
        { provide: HolderAuthService, useValue: { givenName: givenName.asReadonly() } },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    outcome = TestBed.inject(EntitlementOutcomeStore);
  });

  it('is the entitlement route, protected by the step guard, with a back button to Inicio', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];
    const route = screens.find((r) => r.path === 'entitlement');

    expect(route?.canActivate).toEqual([journeyStepGuard]);
    expect(route?.data).toEqual({ back: '' });
  });

  describe('greeting (AC-01, FR-19, AD-13)', () => {
    it('greets the holder by the given name of the ID Token', () => {
      create(NEVER);

      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('entitlement.greeting');
      expect(fixture.nativeElement.textContent).toContain('entitlement.notYou');
    });

    it('with no name, the title is the waiting text and the notice has no name', () => {
      givenName.set('');
      create(NEVER);

      const h1 = fixture.nativeElement.querySelector('h1') as HTMLElement;
      expect(h1.textContent).toContain('entitlement.checking');
      expect(h1.textContent).not.toContain('entitlement.greeting');
      expect(fixture.nativeElement.textContent).toContain('entitlement.notYouNoName');
    });

    it('«¿No eres …?» leads back to the Verifier to sign in again', () => {
      create(NEVER);

      (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

      expect(restartLogin).toHaveBeenCalledTimes(1);
    });
  });

  it('AC-16: shows the waiting indicator while the requests are looked for, calling POST /entitlement once', () => {
    create(NEVER);

    const status = statusRegions(fixture.nativeElement);
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toContain('entitlement.checking');
    expect(verifyEntitlement).toHaveBeenCalledTimes(1);
    expect(verifyEntitlement).toHaveBeenCalledWith();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('AC-21: with result confirmed goes to Correo without keeping Comprobación in the history', () => {
    create(of({ result: 'confirmed', requests: [available] }));

    expect(navigate).toHaveBeenCalledWith(['/', 'email'], { replaceUrl: true });
    expect(discardTokens).not.toHaveBeenCalled();
    expect(outcome.outcome()).toBeNull();
  });

  it('AC-01, EC-08: with some request available and another not, it is still confirmed and goes to Correo', () => {
    create(
      of({
        result: 'confirmed',
        requests: [available, { id: 'r2', status: 'identity_mismatch', renewal: false, mismatched_fields: ['given_name'] }],
      }),
    );

    expect(navigate).toHaveBeenCalledWith(['/', 'email'], { replaceUrl: true });
  });

  describe('result not_confirmed: the service has withdrawn the journey', () => {
    it('AC-03: reason no_requests goes to Sin solicitudes', () => {
      create(of({ result: 'not_confirmed', reason: 'no_requests', requests: [] }));

      expect(navigate).toHaveBeenCalledWith(['/', 'no-requests'], { replaceUrl: true });
      expect(outcome.outcome()).toEqual({ kind: 'no-requests' });
    });

    it('AC-03: reason not_found goes to the not entitled case, with the support contact', () => {
      create(of({ result: 'not_confirmed', reason: 'not_found', requests: [] }));

      expect(navigate).toHaveBeenCalledWith(['/', 'error', 'not-entitled'], { replaceUrl: true });
      expect(outcome.outcome()).toBeNull();
    });

    it.each<[string, SourceRequest]>([
      ['identity_mismatch', { id: 'r1', status: 'identity_mismatch', renewal: true, mismatched_fields: ['family_names'] }],
      ['identifier_mismatch', { id: 'r1', status: 'identifier_mismatch', renewal: false }],
    ])('AC-04: with no reason and a single request %s goes to Tus datos no coinciden, holding that request', (_name, single) => {
      create(of({ result: 'not_confirmed', requests: [single] }));

      expect(navigate).toHaveBeenCalledWith(['/', 'request-unavailable'], { replaceUrl: true });
      expect(outcome.outcome()).toEqual({ kind: 'request-unavailable', requests: [single] });
    });

    it('AC-04: with no reason and several requests, none available, goes to Tus datos no coinciden holding all of them', () => {
      const requests: SourceRequest[] = [
        { id: 'r1', status: 'identity_mismatch', renewal: false },
        { id: 'r2', status: 'identifier_mismatch', renewal: false },
      ];
      create(of({ result: 'not_confirmed', requests }));

      expect(navigate).toHaveBeenCalledWith(['/', 'request-unavailable'], { replaceUrl: true });
      expect(outcome.outcome()).toEqual({ kind: 'request-unavailable', requests });
      expect(discardTokens).toHaveBeenCalledTimes(1);
    });

    it.each<[string, EntitlementResult]>([
      ['no_requests', { result: 'not_confirmed', reason: 'no_requests', requests: [] }],
      ['not_found', { result: 'not_confirmed', reason: 'not_found', requests: [] }],
      ['a single request not available', { result: 'not_confirmed', requests: [{ id: 'r1', status: 'under_review', renewal: false }] }],
    ])('AC-03, W4: %s discards the tokens before leaving, the journey is over', (_name, result) => {
      create(of(result));

      expect(discardTokens).toHaveBeenCalledTimes(1);
      expect(discardTokens.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
    });
  });

  it.each([
    ['authentic_source_unavailable', 503],
    [NETWORK_ERROR, 0],
    [UNEXPECTED_ERROR, 500],
  ])('AC-18: %s goes to the source unavailable case, whose retry checks again, keeping the tokens', (type, status) => {
    create(problem(type, status));

    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'source-unavailable'], { replaceUrl: true });
    expect(discardTokens).not.toHaveBeenCalled();
  });

  it.each([
    ['journey_closed', 410],
    ['step_not_allowed', 409],
    ['unauthenticated', 401],
  ])('ES-08: %s is left to the journey interceptor or the login (EUD-314)', (type, status) => {
    create(problem(type, status));

    expect(navigate).not.toHaveBeenCalled();
  });

  // axe no evalúa `page-has-heading-one` sobre un fragmento: el título se comprueba aquí (review r4).
  it('NFR-5: the screen has a single title', () => {
    create(NEVER);

    expect(fixture.nativeElement.querySelectorAll('h1')).toHaveLength(1);
  });

  it('does not navigate once the holder has left the screen', () => {
    const response = new Subject<EntitlementResult>();
    create(response);

    fixture.destroy();
    response.next({ result: 'confirmed', requests: [available] });

    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['es', 'en'])('NFR-2: has the Comprobación texts in %s', (lang) => {
    const texts = catalog(lang);

    for (const key of ['checking', 'greeting', 'notYou', 'notYouNoName', 'signInAgain']) {
      expect(texts[`entitlement.${key}`]).toBeTruthy();
    }
  });

  describe.each([
    ['with the name', 'María'],
    ['with no name', ''],
  ])('NFR-5: has no accessibility violations %s', (_name, name) => {
    it('while the requests are looked for', async () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('es', catalog('es'));
      translate.use('es');
      givenName.set(name);
      create(NEVER);

      expect(await axe(fixture.nativeElement)).toHaveNoViolations();
    });
  });
});
