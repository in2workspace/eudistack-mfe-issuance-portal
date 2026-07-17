import { IssuanceStartSessionStore } from './issuance-start-session.store';

describe('IssuanceStartSessionStore', () => {
  let store: IssuanceStartSessionStore;

  beforeEach(() => {
    store = new IssuanceStartSessionStore();
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('creates a session with a unique id, the given tenant and state "iniciada", persisted to sessionStorage (AC-02)', () => {
    const session = store.create('cgcom');

    expect(session).not.toBeNull();
    expect(session?.tenant).toBe('cgcom');
    expect(session?.state).toBe('iniciada');
    expect(typeof session?.id).toBe('string');
    expect(session?.id.length).toBeGreaterThan(0);

    const persisted = JSON.parse(sessionStorage.getItem('issuance_start_session') ?? 'null');
    expect(persisted).toEqual(session);
  });

  it('generates a different id for each session', () => {
    const first = store.create('cgcom');
    const second = store.create('cgcom');

    expect(first?.id).not.toEqual(second?.id);
  });

  it('returns null without throwing when sessionStorage.setItem fails (ES-03, fail-closed)', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => store.create('cgcom')).not.toThrow();
    expect(store.create('cgcom')).toBeNull();
  });
});
