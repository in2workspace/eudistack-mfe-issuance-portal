import { TestBed } from '@angular/core/testing';
import { JourneyIssuanceStore } from './journey-issuance.store';

describe('JourneyIssuanceStore', () => {
  let store: JourneyIssuanceStore;

  beforeEach(() => {
    store = TestBed.inject(JourneyIssuanceStore);
  });

  it('starts with nothing to call', () => {
    expect(store.pendingCall()).toBeNull();
  });

  it('EUD-358: holds no email, the verified one lives in the service', () => {
    expect('email' in store).toBe(false);
    expect('confirm' in store).toBe(false);
  });

  it('with the email verified, asks for the confirmation', () => {
    store.requestConfirmation();

    expect(store.pendingCall()).toBe('confirmation');
  });

  it('a new code asks for a new offer', () => {
    store.requestConfirmation();

    store.requestNewOffer();

    expect(store.pendingCall()).toBe('offers');
  });

  it('an offer received leaves nothing to call', () => {
    store.requestConfirmation();

    store.offerReceived();

    expect(store.pendingCall()).toBeNull();
  });

  it('NFR-1: clearing forgets everything', () => {
    store.requestNewOffer();

    store.clear();

    expect(store.pendingCall()).toBeNull();
  });
});
