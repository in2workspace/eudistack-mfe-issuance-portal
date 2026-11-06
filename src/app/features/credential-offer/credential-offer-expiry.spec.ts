import { formatCountdown, isOfferAddressExpired, secondsUntilExpiry } from './credential-offer-expiry';

describe('credential offer expiry', () => {
  const address = { url: 'https://wallet.example/t/abc', expiresAt: 1_000_000 };

  it('counts the whole seconds left until the expiry the service gives', () => {
    expect(secondsUntilExpiry(address, 1_000_000 - 90_000)).toBe(90);
    expect(secondsUntilExpiry(address, 1_000_000 - 90_500)).toBe(91);
  });

  it('expires exactly at the expiry and stays at zero after it', () => {
    expect(isOfferAddressExpired(address, 999_999)).toBe(false);
    expect(isOfferAddressExpired(address, 1_000_000)).toBe(true);
    expect(secondsUntilExpiry(address, 2_000_000)).toBe(0);
  });

  it.each([
    [582, '09:42'],
    [60, '01:00'],
    [5, '00:05'],
    [0, '00:00'],
  ])('shows %i seconds as %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text);
  });
});
