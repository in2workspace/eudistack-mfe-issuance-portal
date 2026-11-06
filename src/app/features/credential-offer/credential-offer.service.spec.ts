import { TestBed } from '@angular/core/testing';
import { CredentialOfferService, MAX_QR_PAYLOAD_CHARS } from './credential-offer.service';

describe('CredentialOfferService', () => {
  const NOW = Date.parse('2026-11-06T12:00:00Z');
  let service: CredentialOfferService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    service = TestBed.inject(CredentialOfferService);
  });

  afterEach(() => {
    service.reset();
    jest.useRealTimers();
  });

  const address = (seconds: number, url = 'https://wallet.example/t/abc') => ({ url, expiresAt: NOW + seconds * 1000 });

  it('starts generating, with nothing presented', () => {
    expect(service.status()).toBe('loading');
    expect(service.address()).toBeNull();
  });

  it('AC-02: presents the address ready, with the time left until its expiry', () => {
    service.present(address(600));

    expect(service.status()).toBe('ready');
    expect(service.address()?.url).toBe('https://wallet.example/t/abc');
    expect(service.remainingSeconds()).toBe(600);
  });

  it('AC-05: an address longer than the QR limit is presented without QR', () => {
    service.present(address(600, `https://wallet.example/${'x'.repeat(MAX_QR_PAYLOAD_CHARS)}`));

    expect(service.status()).toBe('ready-without-qr');
  });

  it('AC-06: counts down every second and, at zero, expires keeping the address', () => {
    service.present(address(3));

    jest.advanceTimersByTime(2000);
    expect(service.remainingSeconds()).toBe(1);
    expect(service.status()).toBe('ready');

    jest.advanceTimersByTime(1000);
    expect(service.remainingSeconds()).toBe(0);
    expect(service.status()).toBe('expired');
    expect(service.address()?.url).toBe('https://wallet.example/t/abc');
  });

  it('AC-06: follows the clock even if the timer runs late', () => {
    service.present(address(600));

    jest.setSystemTime(NOW + 599_000);
    jest.advanceTimersByTime(1000);

    expect(service.status()).toBe('expired');
  });

  it('EC-06: an address already expired when received is presented expired', () => {
    service.present(address(-5));

    expect(service.status()).toBe('expired');
    expect(service.remainingSeconds()).toBe(0);
  });

  it('generating again forgets the previous address and stops its countdown', () => {
    service.present(address(3));

    service.startLoading();
    jest.advanceTimersByTime(5000);

    expect(service.status()).toBe('loading');
    expect(service.address()).toBeNull();
  });

  it('W5: reset() forgets the address with the ticket and stops the countdown when QR is left', () => {
    service.present(address(3));

    service.reset();
    jest.advanceTimersByTime(5000);

    expect(service.address()).toBeNull();
    expect(service.remainingSeconds()).toBe(0);
    expect(service.status()).toBe('loading');
  });

  it('NFR-1: never writes the address to sessionStorage, localStorage or the console', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    const log = jest.spyOn(console, 'log');

    service.present(address(600));
    jest.advanceTimersByTime(3000);

    expect(setItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    setItem.mockRestore();
    log.mockRestore();
  });
});
