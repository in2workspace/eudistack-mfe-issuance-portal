import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { CredentialOfferService, MAX_QR_PAYLOAD_CHARS } from './credential-offer.service';
import { CannotContinueReason } from '../issuance-start/cannot-continue-reason';

describe('CredentialOfferService', () => {
  let service: CredentialOfferService;

  const url = { url: 'https://cgcom.example/wallet?credential_offer_uri=ref-1', length: 54 };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CredentialOfferService] });
    service = TestBed.inject(CredentialOfferService);
  });

  it('starts idle, with nothing presented', () => {
    expect(service.status()).toBe('idle');
    expect(service.offer()).toBeNull();
    expect(service.walletInvocationUrl()).toBeNull();
  });

  it('AC-01: presenting an offer shows it ready, with its link', fakeAsync(() => {
    service.present({ reference: 'ref-1', obtainedAt: Date.now() }, url);

    expect(service.status()).toBe('ready');
    expect(service.walletInvocationUrl()).toEqual(url);
    expect(service.cannotContinueReason()).toBeNull();
    discardPeriodicTasks();
    service.cancelPendingWork();
  }));

  it('ES-06: a link longer than the QR limit is presented without QR', fakeAsync(() => {
    const longUrl = { url: 'x'.repeat(MAX_QR_PAYLOAD_CHARS + 1), length: MAX_QR_PAYLOAD_CHARS + 1 };

    service.present({ reference: 'ref-1', obtainedAt: Date.now() }, longUrl);

    expect(service.status()).toBe('ready-without-qr');
    service.cancelPendingWork();
  }));

  it('marking it unavailable withdraws the offer and shows the notice', fakeAsync(() => {
    service.present({ reference: 'ref-1', obtainedAt: Date.now() }, url);

    service.markUnavailable(CannotContinueReason.OfferTimeout);

    expect(service.status()).toBe('unavailable');
    expect(service.offer()).toBeNull();
    expect(service.walletInvocationUrl()).toBeNull();
    expect(service.cannotContinueReason()).toBe(CannotContinueReason.OfferTimeout);
  }));

  it('NFR-S-163-03: never writes the offer to sessionStorage, localStorage or the console', fakeAsync(() => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const log = jest.spyOn(console, 'log');

    service.present({ reference: 'ref-secret', obtainedAt: Date.now() }, url);

    expect(setItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    setItem.mockRestore();
    log.mockRestore();
    service.cancelPendingWork();
  }));

  describe('real expiry timer (ES-03, NFR-S-163-01)', () => {
    it('at 601 s, past the 10 min window, withdraws the offer and shows the unavailable notice', fakeAsync(() => {
      service.present({ reference: 'ref-1', obtainedAt: Date.now() }, url);

      tick(601 * 1000);

      expect(service.status()).toBe('unavailable');
      expect(service.cannotContinueReason()).toBe(CannotContinueReason.OfferUnavailable);
    }));

    it('at 599 s it has not expired yet', fakeAsync(() => {
      service.present({ reference: 'ref-1', obtainedAt: Date.now() }, url);

      tick(599 * 1000);

      expect(service.status()).toBe('ready');
      service.cancelPendingWork();
    }));

    it('cancelPendingWork() cancels the pending timer, so it does not expire after the component is destroyed', fakeAsync(() => {
      service.present({ reference: 'ref-1', obtainedAt: Date.now() }, url);

      service.cancelPendingWork();
      tick(601 * 1000);

      expect(service.status()).toBe('ready');
    }));

    it('presenting a new offer replaces the previous timer', fakeAsync(() => {
      service.present({ reference: 'ref-1', obtainedAt: Date.now() }, url);
      tick(5 * 60 * 1000);

      service.present({ reference: 'ref-2', obtainedAt: Date.now() }, url);
      tick(5 * 60 * 1000 + 1000);

      expect(service.status()).toBe('ready');
      service.cancelPendingWork();
    }));
  });
});
