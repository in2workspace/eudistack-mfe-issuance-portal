import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { RequestUnavailableComponent } from './request-unavailable.component';
import { Request as SourceRequest } from '../../core/api/generated/authentic-source';
import { EntitlementOutcomeStore } from '../../core/journey/entitlement-outcome.store';

expect.extend(toHaveNoViolations);

function catalog(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<
    string,
    string
  >;
}

describe('RequestUnavailableComponent', () => {
  let fixture: ComponentFixture<RequestUnavailableComponent>;
  let navigate: jest.SpyInstance;
  let outcome: EntitlementOutcomeStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestUnavailableComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', catalog('es'));
    translate.use('es');
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    outcome = TestBed.inject(EntitlementOutcomeStore);
  });

  afterEach(() => fixture?.nativeElement.remove());

  function show(...requests: SourceRequest[]): HTMLElement {
    outcome.hold({ kind: 'request-unavailable', requests });
    fixture = TestBed.createComponent(RequestUnavailableComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const mismatch: SourceRequest = {
    id: 'r1',
    status: 'identity_mismatch',
    renewal: false,
    mismatched_fields: ['family_names', 'given_name'],
  };

  it('AC-04: says the data does not match, which data, and that the organisation must update it', () => {
    const element = show(mismatch);

    expect(element.querySelector('h1')?.textContent).toBe('Tus datos no coinciden');
    const fields = Array.from(element.querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(fields).toEqual(['Apellidos', 'Nombre']);
    expect(element.textContent).toContain('Pide a tu organización que actualice tus datos y vuelve a entrar.');
  });

  it('AC-04: with no mismatched_fields from the source, shows no list of data', () => {
    const element = show({ id: 'r1', status: 'identity_mismatch', renewal: false });

    expect(element.querySelector('h1')?.textContent).toBe('Tus datos no coinciden');
    expect(element.querySelector('ul')).toBeNull();
  });

  it('AC-04: with identifier_mismatch shows the variant: the request is not in the holder name, with no list', () => {
    const element = show({ id: 'r1', status: 'identifier_mismatch', renewal: false });

    expect(element.querySelector('h1')?.textContent).toBe('Esta solicitud no está a tu nombre');
    expect(element.textContent).toContain('Pide a quien la solicitó que la revise');
    expect(element.querySelector('ul')).toBeNull();
  });

  it('AC-04: with several requests none available lists each one with its problem and what to do', () => {
    const element = show(
      { id: 'r1', status: 'identity_mismatch', renewal: false, organization: 'Colegio de Madrid', display_identifier: '28/1' },
      { id: 'r2', status: 'identifier_mismatch', renewal: false, display_identifier: '45/2' },
      { id: 'r3', status: 'under_review', renewal: false, organization: 'Colegio de Ávila' },
    );

    const rows = Array.from(element.querySelectorAll('[data-testid="unavailable-request"]')).map((li) => li.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Colegio de Madrid');
    expect(rows[0]).toContain('N.º 28/1');
    expect(rows[0]).toContain('Pide que los actualicen.');
    expect(rows[1]).toContain('N.º 45/2');
    expect(rows[1]).toContain('Pide a quien la solicitó que la revise.');
    expect(rows[2]).toContain('Pide que los corrijan en su origen.');
    expect(element.querySelector('h1')?.textContent).toBe('Tus datos no coinciden');
    expect(element.textContent).not.toMatch(/r[1-3]/);
  });

  it('NFR-5: the list of several requests has no accessibility violations', async () => {
    const element = show(
      { id: 'r1', status: 'identity_mismatch', renewal: false, organization: 'Colegio de Madrid' },
      { id: 'r2', status: 'identifier_mismatch', renewal: false },
    );

    expect(await axe(element)).toHaveNoViolations();
  });

  it('FR-18: «Salir» forgets what was in memory and goes to Inicio', () => {
    const element = show(mismatch);

    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Salir')!
      .click();

    expect(outcome.outcome()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it.each(['es', 'en'])('has every Tus datos no coinciden text in %s', (lang) => {
    const texts = catalog(lang);
    const keys = Object.keys(catalog('es')).filter((key) => key.startsWith('requestUnavailable.'));

    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => expect(texts[key]).toBeTruthy());
  });

  it.each([
    ['mismatch', mismatch],
    ['identifier variant', { id: 'r1', status: 'identifier_mismatch', renewal: false } as SourceRequest],
  ])('NFR-5: has no accessibility violations (%s)', async (_name, request) => {
    expect(await axe(show(request))).toHaveNoViolations();
  });
});
