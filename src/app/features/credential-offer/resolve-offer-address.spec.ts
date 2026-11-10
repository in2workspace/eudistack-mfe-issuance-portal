import { Offer } from '../../core/api/generated/journey';
import { resolveOfferAddress } from './resolve-offer-address';

const OFFER_URI = 'https://sandbox.dev.eudistack.net/issuer/credential-offer/abc?x=1&y=2';
const OFFER_LINK = `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(OFFER_URI)}`;
const EXPIRES_AT = '2026-11-06T12:10:00Z';
const ONBOARDING_EXPIRES_AT = '2026-11-06T12:05:00Z';
const WALLET = 'https://wallet.sandbox.dev.eudistack.net';

function offer(overrides: Partial<Offer> = {}): Offer {
  return { credential_offer_uri: OFFER_LINK, expires_at: EXPIRES_AT, ...overrides };
}

describe('resolveOfferAddress', () => {
  describe('tenant with onboarding tickets', () => {
    const withTicket = offer({
      onboarding_url: 'https://wallet.sandbox.dev.eudistack.net/t/Zk3q9Xw2Lp7Rt4Vb8Nc1Ha',
      onboarding_expires_at: ONBOARDING_EXPIRES_AT,
    });

    it('AC-02: uses the onboarding address as it comes, until onboarding_expires_at', () => {
      expect(resolveOfferAddress(withTicket, WALLET)).toEqual({
        url: 'https://wallet.sandbox.dev.eudistack.net/t/Zk3q9Xw2Lp7Rt4Vb8Nc1Ha',
        expiresAt: Date.parse(ONBOARDING_EXPIRES_AT),
      });
    });

    it('AC-02: accepts an onboarding address under the wallet path of the same origin', () => {
      expect(resolveOfferAddress(withTicket, `${WALLET}/wallet`)?.url).toBe(withTicket.onboarding_url);
    });

    it('AC-09: never builds the wallet address: without wallet_url it gives no address at all', () => {
      expect(resolveOfferAddress(withTicket, undefined)).toBeNull();
      expect(resolveOfferAddress(withTicket, '')).toBeNull();
    });

    it.each([
      ['javascript:', 'javascript:alert(document.domain)'],
      ['http:', 'http://wallet.sandbox.dev.eudistack.net/t/Zk3q9Xw2'],
      ['another host', 'https://evil.example/t/Zk3q9Xw2'],
      ['another port', 'https://wallet.sandbox.dev.eudistack.net:8443/t/Zk3q9Xw2'],
      ['not an address', 'not a url'],
    ])('B1, ES-03: rejects an onboarding address with %s', (_case, onboardingUrl) => {
      expect(resolveOfferAddress(offer({ onboarding_url: onboardingUrl, onboarding_expires_at: ONBOARDING_EXPIRES_AT }), WALLET)).toBeNull();
    });

    it('B1, ES-03: does not build the wallet address when the onboarding address is rejected', () => {
      const result = resolveOfferAddress(offer({ onboarding_url: 'https://evil.example/t/x', onboarding_expires_at: ONBOARDING_EXPIRES_AT }), WALLET);

      expect(result).toBeNull();
    });

    it('N1: gives no address when onboarding_expires_at is missing', () => {
      expect(resolveOfferAddress(offer({ onboarding_url: withTicket.onboarding_url }), WALLET)).toBeNull();
    });
  });

  describe('tenant without onboarding tickets', () => {
    it('AC-04: builds <wallet_url>/protocol/callback with the credential_offer_uri value encoded, until expires_at', () => {
      expect(resolveOfferAddress(offer(), WALLET)).toEqual({
        url: `${WALLET}/protocol/callback?credential_offer_uri=${encodeURIComponent(OFFER_URI)}`,
        expiresAt: Date.parse(EXPIRES_AT),
      });
    });

    it('AC-04: keeps the credential_offer_uri value unmodified once decoded', () => {
      const url = new URL(resolveOfferAddress(offer(), WALLET)!.url);

      expect(url.searchParams.get('credential_offer_uri')).toBe(OFFER_URI);
    });

    it.each(['/', '//', '///'])('does not double the slash of a wallet_url that ends with %s', (slashes) => {
      expect(resolveOfferAddress(offer(), `${WALLET}${slashes}`)!.url).toMatch(/^https:\/\/wallet\.sandbox\.dev\.eudistack\.net\/protocol\/callback\?/);
    });

    it.each([
      ['the link has no credential_offer_uri', offer({ credential_offer_uri: 'openid-credential-offer://?credential_offer=%7B%7D' }), WALLET],
      ['the link has no query', offer({ credential_offer_uri: 'openid-credential-offer://' }), WALLET],
      ['there is no wallet_url', offer(), undefined],
      ['wallet_url is empty', offer(), ''],
    ])('ES-03: gives no address when %s', (_case, input, wallet) => {
      expect(resolveOfferAddress(input, wallet)).toBeNull();
    });
  });

  it('ES-03: gives no address when the expiry is not a date', () => {
    expect(resolveOfferAddress(offer({ expires_at: 'soon' }), WALLET)).toBeNull();
  });
});
