import { isOfferAddressExpired, secondsUntilExpiry } from './credential-offer-expiry';

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
});
