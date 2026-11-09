import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { EntitlementComponent } from './entitlement.component';
import { ApiProblemError, NETWORK_ERROR, UNEXPECTED_ERROR } from '../../core/api/api-problem.error';
import { EntitlementApi, EntitlementResult } from '../../core/api/generated/authentic-source';
import { journeyStepGuard } from '../../core/journey/journey-step.guard';
import { routes } from '../../app.routes';
import { SESSION_ACTIONS } from '../../core/session/session-actions';

expect.extend(toHaveNoViolations);

describe('EntitlementComponent', () => {
  let fixture: ComponentFixture<EntitlementComponent>;
  let verifyEntitlement: jest.Mock<Observable<EntitlementResult>>;
  let navigate: jest.SpyInstance;
  let discardTokens: jest.Mock;

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
    TestBed.configureTestingModule({
      imports: [EntitlementComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: EntitlementApi, useValue: { verifyEntitlement } },
        { provide: SESSION_ACTIONS, useValue: { restartLogin: jest.fn(), discardTokens } },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('is the entitlement route, protected by the step guard, with a back button to Inicio', () => {
    const screens = routes.find((r) => r.path === '' && r.children)?.children ?? [];
    const route = screens.find((r) => r.path === 'entitlement');

    expect(route?.canActivate).toEqual([journeyStepGuard]);
    expect(route?.data).toEqual({ back: '' });
  });

  it('AC-16: shows the waiting indicator while the entitlement is checked, calling POST /entitlement once', () => {
    create(NEVER);

    const status = fixture.nativeElement.querySelector('output') as HTMLElement;
    expect(status.textContent).toContain('entitlement.checking');
    expect(verifyEntitlement).toHaveBeenCalledTimes(1);
    expect(verifyEntitlement).toHaveBeenCalledWith();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('AC-16: with result confirmed goes to Datos without keeping Comprobación in the history', () => {
    create(of({ result: 'confirmed', attestation: { type_name: 'DoctorID', fields: [], email_required: true } }));

    expect(navigate).toHaveBeenCalledWith(['/', 'user-data'], { replaceUrl: true });
  });

  it('AC-10: with result not_confirmed goes to the not entitled case, whatever the reason', () => {
    create(of({ result: 'not_confirmed', reason: 'identifier_mismatch' }));

    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'not-entitled'], { replaceUrl: true });
  });

  it('W4: with result not_confirmed discards the tokens before leaving, the journey is over', () => {
    create(of({ result: 'not_confirmed', reason: 'not_entitled' }));

    expect(discardTokens).toHaveBeenCalledTimes(1);
    expect(discardTokens.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });

  it('keeps the tokens when the entitlement is confirmed', () => {
    create(of({ result: 'confirmed' }));

    expect(discardTokens).not.toHaveBeenCalled();
  });

  it.each([
    ['authentic_source_unavailable', 503],
    [NETWORK_ERROR, 0],
    [UNEXPECTED_ERROR, 500],
  ])('AC-11: %s goes to the source unavailable case, whose retry checks again', (type, status) => {
    create(problem(type, status));

    expect(navigate).toHaveBeenCalledWith(['/', 'error', 'source-unavailable'], { replaceUrl: true });
  });

  it.each([
    ['journey_closed', 410],
    ['step_not_allowed', 409],
    ['unauthenticated', 401],
  ])('ES-06: %s is left to the journey interceptor or the login (EUD-314)', (type, status) => {
    create(problem(type, status));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate once the holder has left the screen', () => {
    const response = new Subject<EntitlementResult>();
    create(response);

    fixture.destroy();
    response.next({ result: 'confirmed' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['es', 'en'])('NFR-2: has the waiting text in %s', (lang) => {
    const catalog = JSON.parse(
      readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8'),
    ) as Record<string, string>;

    expect(catalog['entitlement.checking']).toBeTruthy();
  });

  it('NFR-3: has no accessibility violations', async () => {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { 'entitlement.checking': 'Estamos comprobando tu derecho a la atestación' });
    translate.use('es');
    create(NEVER);

    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });
});
