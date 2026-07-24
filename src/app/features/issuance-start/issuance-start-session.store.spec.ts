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
});