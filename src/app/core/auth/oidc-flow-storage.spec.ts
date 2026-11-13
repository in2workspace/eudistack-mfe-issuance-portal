import { FLOW_STORAGE_KEY, OidcFlowStorage, REDIRECT_MARK_KEY } from './oidc-flow-storage';

describe('OidcFlowStorage', () => {
  const KEY = 'issuance-portal';
  let storage: OidcFlowStorage;

  function browserContents(): string {
    const read = (s: Storage) => Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i) as string)}`);
    return [...read(sessionStorage), ...read(localStorage)].join('\n');
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    storage = new OidcFlowStorage();
  });

  it('NFR-3: tokens and user data stay in memory, never in sessionStorage or localStorage', () => {
    storage.write(KEY, JSON.stringify({ authnResult: { access_token: 'at-secret', id_token: 'idt-secret' }, userData: { given_name: 'Maria' } }));

    expect(browserContents()).toBe('');
    expect(JSON.parse(storage.read(KEY) as string)).toEqual({
      authnResult: { access_token: 'at-secret', id_token: 'idt-secret' },
      userData: { given_name: 'Maria' },
    });
  });

  it('keeps only the code verifier, state and nonce in sessionStorage while the holder is at the Verifier', () => {
    storage.write(KEY, JSON.stringify({ codeVerifier: 'cv', authStateControl: 'st', authNonce: 'no', authWellKnownEndPoints: { a: 1 } }));

    expect(Object.keys(JSON.parse(sessionStorage.getItem(FLOW_STORAGE_KEY) as string)).sort()).toEqual([
      'authNonce',
      'authStateControl',
      'codeVerifier',
    ]);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
  });

  it('reads the flow fields back after a page load, when the memory is empty', () => {
    storage.write(KEY, JSON.stringify({ codeVerifier: 'cv', authStateControl: 'st', authNonce: 'no' }));

    const afterRedirect = new OidcFlowStorage();

    expect(JSON.parse(afterRedirect.read(KEY) as string)).toEqual({ codeVerifier: 'cv', authStateControl: 'st', authNonce: 'no' });
  });

  it('writes done after the redirect update the flow fields without storing the tokens', () => {
    storage.write(KEY, JSON.stringify({ codeVerifier: 'cv', authStateControl: 'st', authNonce: 'no' }));
    const afterRedirect = new OidcFlowStorage();
    afterRedirect.write(
      KEY,
      JSON.stringify({ codeVerifier: 'cv', authStateControl: 'st', authNonce: null, authnResult: { access_token: 'at-secret' } }),
    );

    expect(browserContents()).not.toContain('at-secret');
    expect(JSON.parse(sessionStorage.getItem(FLOW_STORAGE_KEY) as string)).toEqual({ codeVerifier: 'cv', authStateControl: 'st' });
  });

  it('clearFlow leaves nothing in the browser and keeps the rest in memory', () => {
    storage.write(KEY, JSON.stringify({ codeVerifier: 'cv', authStateControl: 'st', userData: { given_name: 'Maria' } }));

    storage.clearFlow();

    expect(browserContents()).toBe('');
    expect(JSON.parse(storage.read(KEY) as string)).toEqual({ userData: { given_name: 'Maria' } });
  });

  it('W4, NFR-3: the redirect mark is only a timestamp, read back, and cleared on its own', () => {
    storage.writeRedirectMark(1_700_000_000_000);

    expect(sessionStorage.getItem(REDIRECT_MARK_KEY)).toBe('1700000000000');
    expect(localStorage.length).toBe(0);
    expect(storage.readRedirectMark()).toBe(1_700_000_000_000);

    storage.clearRedirectMark();

    expect(storage.readRedirectMark()).toBeNull();
    expect(browserContents()).toBe('');
  });

  it('W4: an unreadable redirect mark counts as none', () => {
    sessionStorage.setItem(REDIRECT_MARK_KEY, 'not-a-number');

    expect(storage.readRedirectMark()).toBeNull();
  });

  it('clear forgets everything', () => {
    storage.write(KEY, JSON.stringify({ codeVerifier: 'cv', userData: { given_name: 'Maria' } }));

    storage.clear();

    expect(storage.read(KEY)).toBeNull();
    expect(browserContents()).toBe('');
  });
});
