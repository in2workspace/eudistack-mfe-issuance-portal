import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';
import { EntitlementOutcomeStore, heldOutcomeGuard } from './entitlement-outcome.store';

describe('EntitlementOutcomeStore', () => {
  let store: EntitlementOutcomeStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    store = TestBed.inject(EntitlementOutcomeStore);
  });

  const run = (kind: 'no-requests' | 'request-unavailable') =>
    TestBed.runInInjectionContext(() => heldOutcomeGuard(kind)({} as never, {} as never));

  it('starts with nothing and holds only in memory, never in the browser storage', () => {
    store.hold({ kind: 'request-unavailable', requests: [{ id: 'r1', status: 'identifier_mismatch', renewal: false }] });

    expect(sessionStorage.length + localStorage.length).toBe(0);
    store.clear();
    expect(store.outcome()).toBeNull();
  });

  it('AD-8: the guard lets in the screen of what is held', () => {
    store.hold({ kind: 'no-requests' });

    expect(run('no-requests')).toBe(true);
  });

  it.each<['no-requests' | 'request-unavailable', boolean]>([
    ['no-requests', false],
    ['request-unavailable', true],
  ])('AD-8: the guard of %s with nothing in memory (or another outcome) goes to Inicio', (kind, holdOther) => {
    if (holdOther) {
      store.hold({ kind: 'no-requests' });
    }

    const result = run(kind) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/');
  });
});
