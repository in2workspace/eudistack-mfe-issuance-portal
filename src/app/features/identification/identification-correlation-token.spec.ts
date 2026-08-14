import { createCorrelationToken } from './identification-correlation-token';

describe('createCorrelationToken', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('produces a Base64url string of length 22 — 16 bytes / 128 bits without padding (NFR-S-164-02)', () => {
    const token = createCorrelationToken();

    expect(token).toHaveLength(22);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toMatch(/[+/=]/);
  });

  it('sources its randomness from crypto.getRandomValues (CSPRNG) with a 16-byte buffer', () => {
    const spy = jest.spyOn(crypto, 'getRandomValues');

    createCorrelationToken();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveLength(16);
    expect(spy.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
  });

  it('two consecutive tokens are not equal (extremely unlikely to collide from a real CSPRNG)', () => {
    expect(createCorrelationToken()).not.toBe(createCorrelationToken());
  });
});
