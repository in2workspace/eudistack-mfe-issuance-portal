import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { ERROR_REASONS, errorReasonGuard, errorUrl, isErrorReason } from './error-reason';

function texts(lang: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(__dirname, '../../../assets/i18n', `${lang}.json`), 'utf-8')) as Record<string, unknown>;
}

describe('error reasons', () => {
  it('EC-03: only the known cases are error reasons', () => {
    expect(isErrorReason('session-expired')).toBe(true);
    expect(isErrorReason('journey_closed')).toBe(false);
    expect(isErrorReason(null)).toBe(false);
  });

  it('builds the address of a case', () => {
    expect(errorUrl('not-entitled')).toEqual(['/', 'error', 'not-entitled']);
  });

  it.each(['es', 'en'])('NFR-2: every case has its title, description and action in %s', (lang) => {
    const catalog = texts(lang);

    for (const reason of ERROR_REASONS) {
      for (const part of ['title', 'description', 'action']) {
        expect(typeof catalog[`error.${reason}.${part}`]).toBe('string');
      }
    }
  });
});

describe('errorReasonGuard', () => {
  function run(reason: string): boolean | UrlTree {
    const route = { paramMap: convertToParamMap({ reason }) } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => errorReasonGuard(route, {} as RouterStateSnapshot)) as boolean | UrlTree;
  }

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('lets a known case through', () => {
    expect(run('offer-not-renewable')).toBe(true);
  });

  it('EC-03: sends an unknown case to Inicio', () => {
    const result = run('anything');

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
