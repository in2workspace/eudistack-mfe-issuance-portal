import { IssuanceStartSessionStore } from './issuance-start-session.store';
import { IssuanceStartSession } from './issuance-start-session.model';

describe('IssuanceStartSessionStore', () => {
  let store: IssuanceStartSessionStore;

  const aSession: IssuanceStartSession = { id: 'abc123', tenant: 'cgcom', state: 'iniciada' };

  beforeEach(() => {
    store = new IssuanceStartSessionStore();
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('persists the given session to sessionStorage and returns true (AC-02)', () => {
    const persisted = store.create(aSession);

    expect(persisted).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('issuance_start_session') ?? 'null')).toEqual(aSession);
  });

  it('read() returns the session previously persisted by create()', () => {
    store.create(aSession);

    expect(store.read()).toEqual(aSession);
  });

  it('read() returns null when nothing was persisted', () => {
    expect(store.read()).toBeNull();
  });

  it('read() returns null instead of throwing when the persisted value is corrupt JSON (EC-01)', () => {
    sessionStorage.setItem('issuance_start_session', 'not-json');

    expect(store.read()).toBeNull();
  });

  it('returns false without throwing when sessionStorage.setItem fails (ES-03, fail-closed)', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => store.create(aSession)).not.toThrow();
    expect(store.create(aSession)).toBe(false);
  });

  it('read() returns null without throwing when sessionStorage.getItem fails (EC-01)', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => store.read()).not.toThrow();
    expect(store.read()).toBeNull();
  });

  it('update() persists a sealed "redirigida" transition with the correlation fields (AC-02)', () => {
    store.create(aSession);
    const redirected: IssuanceStartSession = {
      ...aSession,
      state: 'redirigida',
      redirectedAt: 1000,
      expiresAt: 1000 + 900_000,
      correlationToken: 'token-abc',
      redirectedMethod: 'certificate',
    };

    const persisted = store.update(redirected);

    expect(persisted).toBe(true);
    expect(store.read()).toEqual(redirected);
  });

  it('update() persists a sealed "retomada" transition with consumedAt (AC-05, uso único)', () => {
    const redirected: IssuanceStartSession = {
      ...aSession,
      state: 'redirigida',
      correlationToken: 'token-abc',
      redirectedMethod: 'certificate',
    };
    store.create(redirected);
    const consumed: IssuanceStartSession = { ...redirected, state: 'retomada', consumedAt: 2000 };

    expect(store.update(consumed)).toBe(true);
    expect(store.read()).toEqual(consumed);
  });

  it('update() returns false without throwing when sessionStorage is unavailable (ES-05, fail-closed)', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => store.update(aSession)).not.toThrow();
    expect(store.update(aSession)).toBe(false);
  });

  it('create()/read() signatures and behaviour are untouched by adding update()/clear() (cero regresión EUD-162/EUD-163/EUD-165)', () => {
    expect(store.create(aSession)).toBe(true);
    expect(store.read()).toEqual(aSession);
  });

  it('clear() removes the current start session — used by retry() (AC-06)', () => {
    store.create(aSession);

    store.clear();

    expect(store.read()).toBeNull();
  });

  it('clear() does not throw when sessionStorage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => store.clear()).not.toThrow();
  });
});